import { prettyError, prettyGroupCollapsed, prettyLog, prettyWarn } from './log'
import { PatchHandle, registerPropertyOverridePatch } from './patchers'

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

class PatchManager {
	registered = new Map<string, PatchHandle>()
	installOrder: string[] = []
	updatingPatches = false
	updateTimeout?: NodeJS.Timeout

	constructor() {
		Blockbench.on('loaded_plugin', ({ plugin }) => {
			prettyLog({ [`Plugin '${plugin.name}' loaded, enabling its patches...`]: '' })
			this.setPluginPatchesEnabled(plugin, true)
			this.queuePatchUpdate()
		})

		Blockbench.on('unloaded_plugin', ({ plugin }) => {
			prettyLog({ [`Plugin '${plugin.name}' unloaded, disabling its patches...`]: '' })
			this.setPluginPatchesEnabled(plugin, false)
			this.queuePatchUpdate()
		})

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

	queuePatchUpdate() {
		if (this.updateTimeout) {
			clearTimeout(this.updateTimeout)
		}
		this.updateTimeout = setTimeout(() => {
			void this.updatePatches()
			this.updateTimeout = undefined
		}, 250)
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
			if (!dependency.isInstalled()) {
				throw new Error(
					`Patch '${patch.id}' depends on patch '${dependencyId}', but it is not installed. This is a bug!`
				)
			}
		}
		return true
	}

	async updatePatches() {
		if (this.updatingPatches) {
			prettyWarn({
				[`Attempted to update patches while patches are already being updated. Ignoring...`]:
					'',
			})
			return
		}
		this.updatingPatches = true

		prettyGroupCollapsed({ 'Updating Patches...': 'color: #aaaaaa;' })
		try {
			prettyLog({ 'Uninstalling patches...': 'color: #ff5555; font-weight: bold;' })
			for (const patchId of this.installOrder.slice().reverse()) {
				const patch = this.registered.get(patchId)!
				if (patch.isInstalled()) {
					await patch.revert()
				}
			}

			prettyLog({ 'Installing enabled patches...': 'color: #55ff55; font-weight: bold;' })
			for (const patchId of this.installOrder) {
				const patch = this.registered.get(patchId)!
				if (!patch.isInstalled() && patch.enabled) {
					if (!this.checkPatchDependencies(patch)) {
						prettyWarn({
							[`Skipping patch '${patch.id}' due to missing dependencies.`]: '',
						})
						continue
					}
					await patch.apply()
				}
			}
		} catch (e) {
			console.groupEnd()
			this.updatingPatches = false
			throw e
		}
		this.updatingPatches = false
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
}
