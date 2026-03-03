import { ModHandle } from './mods'

declare global {
	interface BlockbenchEventMap {
		'blockbench-mod-manager:pre_select_project': ModelProject
	}
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const BlockbenchModManager: {
		registered: Map<string, ModHandle>
		installOrder: string[]
		updatingMods: boolean
		updateTimeout?: NodeJS.Timeout
	}
	interface Window {
		BlockbenchModManager: typeof BlockbenchModManager
	}
}

window.BlockbenchModManager ??= {
	registered: new Map<string, ModHandle>(),
	installOrder: [],
	updatingMods: false,
}

function queueModUpdate() {
	if (BlockbenchModManager.updateTimeout) {
		clearTimeout(BlockbenchModManager.updateTimeout)
	}
	BlockbenchModManager.updateTimeout = setTimeout(() => {
		void updateMods()
		BlockbenchModManager.updateTimeout = undefined
	}, 1000)
}

Blockbench.on('loaded_plugin', ({ plugin }) => {
	setPluginModsEnabled(plugin, true)
	queueModUpdate()
})
Blockbench.on('unloaded_plugin', ({ plugin }) => {
	setPluginModsEnabled(plugin, false)
	queueModUpdate()
})

async function updateMods() {
	if (BlockbenchModManager.updatingMods) {
		console.warn(`Attempted to update mods while mods are already being updated. Ignoring...`)
		return
	}
	BlockbenchModManager.updatingMods = true

	console.groupCollapsed(`Updating Mods...`)
	try {
		console.log('%cUninstalling all mods...', 'color: red; font-weight: bold;')
		for (const modId of BlockbenchModManager.installOrder.slice().reverse()) {
			const mod = BlockbenchModManager.registered.get(modId)!
			if (mod.isInstalled()) {
				await mod.uninstall()
			}
		}

		console.log('%cInstalling enabled mods...', 'color: green; font-weight: bold;')
		for (const modId of BlockbenchModManager.installOrder) {
			const mod = BlockbenchModManager.registered.get(modId)!
			if (!mod.isInstalled()) {
				await mod.install()
			}
		}
	} catch (e) {
		console.groupEnd()
		BlockbenchModManager.updatingMods = false
		throw e
	}
	BlockbenchModManager.updatingMods = false
	console.groupEnd()
}

export function getModOwner(modId: string) {
	const [namespace] = modId.split(':')
	return Plugins.installed.find(p => p.id === namespace)
}

export function validateModId(modId: string) {
	const [namespace] = modId.split(':')
	const plugin = Plugins.installed.find(p => p.id === namespace)
	if (!plugin) {
		console.error(
			`Mod '${modId}' depends on an unknown plugin '${namespace}' which is not installed.`
		)
		return false
	}
	return true
}

export function setPluginModsEnabled(plugin: BBPlugin, enabled: boolean) {
	for (const mod of BlockbenchModManager.registered.values()) {
		const modOwner = getModOwner(mod.id)
		if (modOwner?.id === plugin.id) {
			mod.enabled = enabled
		}
	}
}

export function updateModInstallOrder() {
	BlockbenchModManager.installOrder.sort((a, b) => {
		const modA = BlockbenchModManager.registered.get(a)!
		const modB = BlockbenchModManager.registered.get(b)!
		return modB.priority - modA.priority
	})

	// Ensure dependencies are installed before the mod that depends on them
	for (const modId of BlockbenchModManager.installOrder) {
		const mod = BlockbenchModManager.registered.get(modId)!
		if (mod.dependencies === undefined) continue
		for (const dependencyId of mod.dependencies) {
			const dependencyIndex = BlockbenchModManager.installOrder.indexOf(dependencyId)
			if (dependencyIndex === -1) {
				throw new Error(`Mod '${modId}' depends on unknown mod '${dependencyId}'`)
			}
			const modIndex = BlockbenchModManager.installOrder.indexOf(modId)
			if (dependencyIndex > modIndex) {
				// Move the dependency before the mod
				BlockbenchModManager.installOrder.splice(dependencyIndex, 1)
				BlockbenchModManager.installOrder.splice(modIndex, 0, dependencyId)
			}
		}
	}
}
