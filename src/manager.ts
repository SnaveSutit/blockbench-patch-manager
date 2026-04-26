import { PatchHandle } from './patchers'

declare global {
	interface BlockbenchEventMap {
		'blockbench-patch-manager:pre_select_project': ModelProject
	}
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const BlockbenchPatchManager: {
		registered: Map<string, PatchHandle>
		installOrder: string[]
		updatingPatches: boolean
		updateTimeout?: NodeJS.Timeout
	}
	interface Window {
		BlockbenchPatchManager: typeof BlockbenchPatchManager
	}
}

window.BlockbenchPatchManager ??= {
	registered: new Map<string, PatchHandle>(),
	installOrder: [],
	updatingPatches: false,
}

function queuePatchUpdate() {
	if (BlockbenchPatchManager.updateTimeout) {
		clearTimeout(BlockbenchPatchManager.updateTimeout)
	}
	BlockbenchPatchManager.updateTimeout = setTimeout(() => {
		void updatePatches()
		BlockbenchPatchManager.updateTimeout = undefined
	}, 1000)
}

Blockbench.on('loaded_plugin', ({ plugin }) => {
	setPluginPatchesEnabled(plugin, true)
	queuePatchUpdate()
})
Blockbench.on('unloaded_plugin', ({ plugin }) => {
	setPluginPatchesEnabled(plugin, false)
	queuePatchUpdate()
})

function checkPatchDependencies(patch: PatchHandle) {
	if (patch.dependencies === undefined) return true
	for (const dependencyId of patch.dependencies) {
		const dependency = BlockbenchPatchManager.registered.get(dependencyId)
		if (!dependency) {
			console.warn(`Patch '${patch.id}' depends on unknown patch '${dependencyId}'.`)
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

async function updatePatches() {
	if (BlockbenchPatchManager.updatingPatches) {
		console.warn(
			`Attempted to update patches while patches are already being updated. Ignoring...`
		)
		return
	}
	BlockbenchPatchManager.updatingPatches = true

	console.groupCollapsed(`Updating Patches...`)
	try {
		console.log('%cUninstalling all patches...', 'color: red; font-weight: bold;')
		for (const patchId of BlockbenchPatchManager.installOrder.slice().reverse()) {
			const patch = BlockbenchPatchManager.registered.get(patchId)!
			if (patch.isInstalled()) {
				await patch.revert()
			}
		}

		console.log('%cInstalling enabled patches...', 'color: green; font-weight: bold;')
		for (const patchId of BlockbenchPatchManager.installOrder) {
			const patch = BlockbenchPatchManager.registered.get(patchId)!
			if (!patch.isInstalled() && patch.enabled) {
				if (!checkPatchDependencies(patch)) {
					console.warn(`Skipping patch '${patch.id}' due to missing dependencies.`)
					continue
				}
				await patch.apply()
			}
		}
	} catch (e) {
		console.groupEnd()
		BlockbenchPatchManager.updatingPatches = false
		throw e
	}
	BlockbenchPatchManager.updatingPatches = false
	console.groupEnd()
}

export function getPatchOwner(modId: string) {
	const [namespace] = modId.split(':')
	return Plugins.registered[namespace]
}

export function validatePatchId(patchId: string) {
	const [namespace] = patchId.split(':')
	if (namespace === 'blockbench-patch-manager') return true
	const plugin = Plugins.registered[namespace]
	if (!plugin) {
		console.error(
			`Patch '${patchId}' depends on an unknown plugin '${namespace}' which is not installed.`
		)
		return false
	}
	return true
}

export function setPluginPatchesEnabled(plugin: BBPlugin, enabled: boolean) {
	for (const patch of BlockbenchPatchManager.registered.values()) {
		const patchOwner = getPatchOwner(patch.id)
		if (patchOwner?.id === plugin.id) {
			patch.enabled = enabled
		}
	}
}

export function updatePatchApplicationOrder() {
	BlockbenchPatchManager.installOrder.sort((a, b) => {
		const patchA = BlockbenchPatchManager.registered.get(a)!
		const patchB = BlockbenchPatchManager.registered.get(b)!
		return patchB.priority - patchA.priority
	})

	// Ensure dependencies are installed before the mod that depends on them
	for (const patchId of BlockbenchPatchManager.installOrder) {
		const patch = BlockbenchPatchManager.registered.get(patchId)!
		if (patch.dependencies === undefined) continue
		for (const dependencyId of patch.dependencies) {
			const dependencyIndex = BlockbenchPatchManager.installOrder.indexOf(dependencyId)
			if (dependencyIndex === -1) {
				throw new Error(`Patch '${patchId}' depends on unknown patch '${dependencyId}'`)
			}
			const patchIndex = BlockbenchPatchManager.installOrder.indexOf(patchId)
			if (dependencyIndex > patchIndex) {
				// Move the dependency before the patch
				BlockbenchPatchManager.installOrder.splice(dependencyIndex, 1)
				BlockbenchPatchManager.installOrder.splice(patchIndex, 0, dependencyId)
			}
		}
	}
}
