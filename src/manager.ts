import { prettyError, prettyGroupCollapsed, prettyLog, prettyWarn } from './log'
import { PatchHandle, registerPropertyOverridePatch } from './patchers'
import PACKAGE from '../package.json'
/// <reference types="blockbench-types" />

/**
 * How long (ms) to wait after a patch update before another one may run
 * immediately. Requests that arrive during the cooldown are collapsed into a
 * single trailing update, and each request resets the timer.
 */
const PATCH_UPDATE_COOLDOWN = 250

declare global {
	interface BlockbenchEventMap {
		'blockbench-patch-manager:pre_select_project': ModelProject
	}
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const BlockbenchPatchManager: PatchManager
	interface Window {
		BlockbenchPatchManager: typeof BlockbenchPatchManager
	}
}

class PatchManager implements Deletable {
	static latestVersion = PACKAGE.version
	version = PACKAGE.version

	registered = new Map<string, PatchHandle>()
	installOrder: string[] = []

	private updateCooldown?: ReturnType<typeof setTimeout>
	private pendingUpdate = false
	private updatingPatches = false

	static upgrade(oldManager: PatchManager) {
		oldManager.delete()
		const manager = new PatchManager()
		manager.installOrder = [...oldManager.installOrder]
		for (const [patchId, patch] of oldManager.registered) {
			manager.registered.set(patchId, patch)
		}
		manager.runPatchUpdate()
		return manager
	}

	constructor() {
		Blockbench.addListener('loaded_plugin', this.onLoadedPlugin)
		Blockbench.addListener('unloaded_plugin', this.onUnloadedPlugin)

		window.BlockbenchPatchManager = this

		registerPropertyOverridePatch({
			id: `blockbench-patch-manager:event-hook/pre-select-project`,
			priority: -Infinity,

			target: ModelProject.prototype,
			key: 'loadEditorState',

			get(original) {
				return function (this: ModelProject) {
					Blockbench.dispatchEvent('blockbench-patch-manager:pre_select_project', this)
					return original.apply(this)
				}
			},
		})
	}

	delete() {
		Blockbench.removeListener('loaded_plugin', this.onLoadedPlugin)
		Blockbench.removeListener('unloaded_plugin', this.onUnloadedPlugin)

		const eventPatch = this.registered.get(
			`blockbench-patch-manager:event-hook/pre-select-project`
		)
		if (this.updateCooldown !== undefined) {
			clearTimeout(this.updateCooldown)
			this.updateCooldown = undefined
		}
		this.pendingUpdate = false

		if (eventPatch) {
			try {
				void eventPatch.revert()
			} catch (error) {
				prettyError({
					[`Failed to revert event hook patch: ${error}`]: 'color: #ff5555;',
				})
			}
			this.registered.delete(eventPatch.id)
		} else {
			prettyWarn({
				[`Failed to find event hook patch when deleting PatchManager. This may cause issues if the plugin is reloaded without restarting Blockbench.`]:
					'color: #ff5555;',
			})
		}
	}

	onLoadedPlugin = ({ plugin }: { plugin: BBPlugin }) => {
		prettyLog({ [`Plugin '${plugin.name}' loaded, enabling its patches...`]: '' })
		this.setPluginPatchesEnabled(plugin, true)
		this.queuePatchUpdate()
	}

	onUnloadedPlugin = ({ plugin }: { plugin: BBPlugin }) => {
		prettyLog({ [`Plugin '${plugin.name}' unloaded, disabling its patches...`]: '' })
		this.setPluginPatchesEnabled(plugin, false)
		this.queuePatchUpdate()
	}

	/**
	 * Requests a patch update.
	 *
	 * The first request runs immediately so plugin loads/unloads feel
	 * responsive. Any further request that arrives within
	 * {@link PATCH_UPDATE_COOLDOWN}ms of the previous one is collapsed into a
	 * single trailing update that runs once the cooldown elapses without another
	 * request — so a slow sequence of plugin loads waits for the final plugin
	 * before re-running.
	 */
	queuePatchUpdate() {
		const runImmediately = this.updateCooldown === undefined
		this.startUpdateCooldown()
		if (runImmediately) {
			this.runPatchUpdate()
		} else {
			this.pendingUpdate = true
		}
	}

	private startUpdateCooldown() {
		if (this.updateCooldown !== undefined) {
			clearTimeout(this.updateCooldown)
		}
		this.updateCooldown = setTimeout(() => {
			this.updateCooldown = undefined
			if (!this.pendingUpdate) return
			this.pendingUpdate = false
			try {
				this.runPatchUpdate()
			} finally {
				// Keep the cooldown running so a request arriving right after the
				// trailing update is still debounced instead of running immediately.
				this.startUpdateCooldown()
			}
		}, PATCH_UPDATE_COOLDOWN)
	}

	private runPatchUpdate() {
		if (this.updatingPatches) {
			// Re-entered from within an update (e.g. a patch that itself triggers
			// a plugin load). Defer to a trailing update instead of recursing.
			this.pendingUpdate = true
			return
		}
		this.updatingPatches = true
		try {
			this.updatePatches()
		} finally {
			this.updatingPatches = false
		}
	}

	addPatch(patch: PatchHandle) {
		if (this.registered.has(patch.id)) {
			prettyWarn({
				[`A Patch with the ID '${patch.id}' is already registered! The old patch will be overwritten.`]:
					'color: #ff5555;',
			})
			const oldPatch = this.registered.get(patch.id)
			if (oldPatch?.isApplied()) {
				try {
					oldPatch.revert()
				} catch (error) {
					prettyError({
						[`Failed to revert old patch '${patch.id}': ${error}`]: 'color: #ff5555;',
					})
				}
			}
			this.removePatch(patch.id)
		}

		this.registered.set(patch.id, patch)
		this.installOrder.push(patch.id)
		this.updatePatchApplicationOrder()
	}

	removePatch(patchId: string) {
		const patch = this.registered.get(patchId)
		if (!patch) {
			prettyWarn({
				[`Attempted to remove unknown patch '${patchId}'!`]: 'color: #ff5555;',
			})
			return
		}
		if (patch.isApplied()) {
			throw new Error(
				`Attempted to remove patch '${patchId}' while it is still applied! This indicates a patch has been improperly managed by a plugin developer.`
			)
		}
		this.registered.delete(patchId)
		const index = this.installOrder.indexOf(patchId)
		if (index !== -1) {
			this.installOrder.splice(index, 1)
		}
	}

	checkPatchDependencies(patch: PatchHandle) {
		if (patch.dependencies === undefined) return true
		for (const dependencyId of patch.dependencies) {
			const dependency = this.registered.get(dependencyId)
			if (!dependency) {
				prettyWarn({
					[`Patch '${patch.id}' depends on unknown patch '${dependencyId}'.`]: '',
				})
				return false
			}
			if (!dependency.isApplied()) {
				throw new Error(
					`Patch '${patch.id}' depends on patch '${dependencyId}', but it is not applied. This is a bug!`
				)
			}
		}
		return true
	}

	updatePatches() {
		prettyGroupCollapsed({ 'Updating Patches...': 'color: #aaaaaa;' })
		try {
			prettyLog({ 'Reverting patches...': 'color: #ff5555; font-weight: bold;' })
			for (const patchId of this.installOrder.slice().reverse()) {
				const patch = this.registered.get(patchId)!
				if (patch.isApplied()) {
					patch.revert()
				}
			}

			prettyLog({ 'Applying enabled patches...': 'color: #55ff55; font-weight: bold;' })
			for (const patchId of this.installOrder) {
				const patch = this.registered.get(patchId)!
				if (!patch.isApplied() && patch.enabled) {
					if (!this.checkPatchDependencies(patch)) {
						prettyWarn({
							[`Skipping patch '${patch.id}' due to missing dependencies.`]: '',
						})
						continue
					}
					patch.apply()
				}
			}
		} catch (e) {
			console.groupEnd()
			throw e
		}
		console.groupEnd()
	}

	getPatchOwner(modId: string) {
		const [namespace] = modId.split(':')
		return Plugins.registered[namespace]
	}

	validatePatchId(patchId: string) {
		const [namespace] = patchId.split(':')
		if (namespace === 'blockbench-patch-manager') return true
		const plugin = Plugins.registered[namespace]
		if (!plugin) {
			prettyError({
				[`Patch '${patchId}' depends on an unknown plugin '${namespace}' which is not installed.`]:
					'',
			})
			return false
		}
		return true
	}

	setPluginPatchesEnabled(plugin: BBPlugin, enabled: boolean) {
		for (const patch of this.registered.values()) {
			const patchOwner = this.getPatchOwner(patch.id)
			if (patchOwner?.id === plugin.id) {
				patch.enabled = enabled
			}
		}
	}

	updatePatchApplicationOrder() {
		this.installOrder.sort((a, b) => {
			const patchA = this.registered.get(a)!
			const patchB = this.registered.get(b)!
			return patchB.priority - patchA.priority
		})

		// Ensure dependencies are installed before the mod that depends on them
		for (const patchId of this.installOrder) {
			const patch = this.registered.get(patchId)!
			if (patch.dependencies === undefined) continue
			for (const dependencyId of patch.dependencies) {
				const dependencyIndex = this.installOrder.indexOf(dependencyId)
				if (dependencyIndex === -1) {
					throw new Error(`Patch '${patchId}' depends on unknown patch '${dependencyId}'`)
				}
				const patchIndex = this.installOrder.indexOf(patchId)
				if (dependencyIndex > patchIndex) {
					// Move the dependency before the patch
					this.installOrder.splice(dependencyIndex, 1)
					this.installOrder.splice(patchIndex, 0, dependencyId)
				}
			}
		}
	}
}

if (window.BlockbenchPatchManager == null) {
	new PatchManager()
} else if (
	// @ts-expect-error - Blockbench VersionUtil library isn't typed yet.
	VersionUtil.compare(
		window.BlockbenchPatchManager.version ?? '0.0.0',
		'<',
		PatchManager.latestVersion
	)
) {
	console.warn(
		`A newer version of Blockbench Patch Mangager (${PatchManager.latestVersion}) is installed alongside an old version ${window.BlockbenchPatchManager.version}. Attempting to upgrade the old version...`
	)
	PatchManager.upgrade(window.BlockbenchPatchManager)
}
