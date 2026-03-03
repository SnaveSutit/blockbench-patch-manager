import subscribable, { Subscribable } from 'simple-subpub'
import { ModInstallError, ModUninstallError } from './errors'
import { updateModInstallOrder, validateModId } from './manager'

export interface ModHandle {
	id: string
	dependencies?: string[]
	priority: number
	enabled: boolean
	isInstalled(): boolean
	install: () => Promise<void>
	uninstall: () => Promise<void>
}

export interface BaseModOptions {
	/**
	 * The unique identifier for the mod. E.g: 'animated-java:example_mod'
	 * The namespace MUST match your plugin's ID.
	 */
	id: string
	/** A list of mod IDs that this mod depends on */
	dependencies?: string[]
	/** The priority of the mod. Higher priority mods will be installed first. */
	priority?: number
}

interface ModOptions<RevertContext extends any | void> extends BaseModOptions {
	/** A function that applies the mod. This function should return a context object that will be passed to the revert function. */
	apply: () => Promise<RevertContext> | RevertContext
	/**
	 * A function that reverts the mod
	 * @param ctx The context object returned by the apply function
	 */
	revert: (ctx: RevertContext) => Promise<void> | void
}

/**
 * Registers a new mod. Mods are changes that need to be applied when the plugin is loaded, and reverted when the plugin is unloaded.
 *
 * Mods can depend on other mods, and will be installed in the correct order.
 *
 * If a mod fails to install, an error will be thrown, and the plugin will fail to load.
 */
export function registerMod<RevertContext extends any | void>(options: ModOptions<RevertContext>) {
	if (!validateModId(options.id)) {
		throw new Error(
			`Failed to register mod with invalid ID '${options.id}'. See previous warnings for more details.`
		)
	}

	let applyContext: RevertContext
	let installed = false

	if (BlockbenchModManager.registered.has(options.id)) {
		throw new Error(`A Mod with the ID '${options.id}' is already registered!`)
	}

	const handle: ModHandle = {
		id: options.id,
		dependencies: options.dependencies,
		priority: options.priority ?? 0,
		enabled: true,

		isInstalled() {
			return installed
		},

		async install() {
			if (!this.enabled) return
			console.log(`Installing '${options.id}'`)
			try {
				if (installed)
					throw new Error(
						`Attempted to install '${options.id}' while it was already installed.`
					)
				applyContext = await options.apply()
				installed = true
			} catch (err) {
				debugger
				throw new ModInstallError(options.id, err as Error)
			}
		},

		async uninstall() {
			if (!this.enabled && !installed) return
			console.log(`Uninstalling '${options.id}'`)
			try {
				if (!installed)
					throw new Error(
						`Attempted to uninstall '${options.id}' before it was installed.`
					)
				await options.revert(applyContext)
				installed = false
			} catch (err) {
				debugger
				throw new ModUninstallError(options.id, err as Error)
			}
		},
	}

	BlockbenchModManager.registered.set(options.id, handle)
	BlockbenchModManager.installOrder.push(options.id)
	updateModInstallOrder()

	return handle
}

interface RegisterProjectModOptions<
	RevertContext extends any | void,
> extends ModOptions<RevertContext> {
	/** A function that checks if the mod should be applied when switching projects */
	condition: ConditionResolvable<{ project: ModelProject }>
	apply: () => RevertContext
	revert: (ctx: RevertContext) => void
	/**
	 * If true, the mod will be reverted (and re-applied) when switching to a different project, even if the new project also meets the condition for applying the mod.
	 */
	alwaysRevertOnProjectChange?: boolean
}

/**
 * Registers a mod that is only applied when a project is selected that meets the provided condition.
 *
 * Used to apply mods that are specific to a custom model format.
 *
 * NOTE: The `apply` and `revert` functions of this mod are not awaited.
 */
export function registerProjectMod<RevertContext extends any | void>(
	options: RegisterProjectModOptions<RevertContext>
) {
	let revertContext: RevertContext | null = null
	// eslint-disable-next-line prefer-const
	let modHandle: ModHandle
	options.alwaysRevertOnProjectChange ??= false

	const onPreSelectProject = (project: ModelProject) => {
		if (modHandle.isInstalled()) return
		if (!Condition(options.condition, { project })) return
		console.log(`Applying project mod '${options.id}'`)
		revertContext = options.apply()
	}

	const onUnselectProject = () => {
		if (!modHandle.isInstalled()) return
		console.log(`Reverting project mod '${options.id}'`)
		options.revert(revertContext!)
		revertContext = null
	}

	modHandle = registerMod({
		...options,

		apply: () => {
			Blockbench.on('blockbench-mod-manager:pre_select_project', onPreSelectProject)
			Blockbench.on('unselect_project', onUnselectProject)
		},

		revert: () => {
			Blockbench.removeListener(
				'blockbench-mod-manager:pre_select_project',
				onPreSelectProject
			)
			Blockbench.removeListener('unselect_project', onUnselectProject)
		},
	})

	return modHandle
}

interface RegisterPluginModOptions<
	RevertContext extends any | void,
> extends ModOptions<RevertContext> {
	apply: () => RevertContext
	revert: (ctx: RevertContext) => void
	/** A function that checks if the mod should be applied when the plugin is loaded */
	condition: (plugin: BBPlugin) => boolean
}

/**
 * Registers a mod that is applied / reverted when a plugin is loaded / unloaded that meets the provided condition.
 */
export function registerPluginMod<RevertContext extends any | void>(
	options: RegisterPluginModOptions<RevertContext>
) {
	let revertContext: RevertContext | undefined

	const onLoadedPlugin = ({ plugin }: { plugin: BBPlugin }) => {
		if (!Condition(options.condition, plugin)) return
		console.log(`Applying plugin mod '${options.id}'`)
		revertContext = options.apply()
	}

	const onUnloadedPlugin = () => {
		// Effectively using revertContext as a boolean to check if the mod is applied
		if (revertContext !== undefined) {
			console.log(`Reverting plugin mod '${options.id}'`)
			options.revert(revertContext)
			revertContext = undefined
		}
	}

	return registerMod({
		...options,

		apply: () => {
			Blockbench.on('loaded_plugin', onLoadedPlugin)
			Blockbench.on('unloaded_plugin', onUnloadedPlugin)
		},

		revert: () => {
			Blockbench.removeListener('loaded_plugin', onLoadedPlugin)
			Blockbench.removeListener('unloaded_plugin', onUnloadedPlugin)
		},
	})
}

/**
 * An object that allows subscribing to the creation and deletion of a deletable, as well as getting the current instance of the deletable.
 */
interface DeletableEventHandler<T> {
	/** The current instance of this deletable */
	get(): T | null
	onCreated: Subscribable<T>['subscribe']
	onDeleted: Subscribable<T>['subscribe']
}

interface RegisterDeletableOptions<T extends Deletable> extends BaseModOptions {
	create: () => T
}

/**
 * Registers a mod that handles the creation and deletion of a {@link Deletable} object on plugin load and unload.
 */
export function registerDeletableHandlerMod<T extends Deletable>(
	options: RegisterDeletableOptions<T>
): DeletableEventHandler<T> {
	let instance: T | null = null
	const created = subscribable<T>()
	const deleted = subscribable<T>()

	const handle: DeletableEventHandler<T> = {
		get: () => instance,
		onCreated: created.subscribe,
		onDeleted: deleted.subscribe,
	}

	registerMod({
		...options,

		apply: () => {
			instance = options.create()
			created.publish(instance)
			return instance
		},

		revert: lastInstance => {
			lastInstance.delete()
			instance = null
			deleted.publish(lastInstance)
		},
	})

	return handle
}

interface PropertyOverrideModOptions<
	Target extends Object,
	Key extends keyof Target,
	Value extends Target[Key],
> extends BaseModOptions {
	target: Target
	key: Key
	/**
	 * If provided, both the `get` and `set` overrides will not be used unless this condition is met.
	 */
	condition?: ConditionResolvable<{ target: Target }>
	/**
	 * If provided, the `get` override will not be used unless this condition is met.
	 */
	getCondition?: ConditionResolvable<{ target: Target; value: Value }>
	/**
	 * @param value The original value returned by the getter.
	 * @returns The value that the getter should actually return.
	 */
	get?: (this: Target, value: Target[Key]) => Value
	/**
	 * If provided, the `set` override will not be used unless this condition is met.
	 */
	setCondition?: ConditionResolvable<{ target: Target; value: Value }>
	/**
	 * @param value The value being set to the property.
	 * @returns The value that should actually be set to the property.
	 */
	set?: (this: Target, value: Value) => Value
}

/**
 * Registers a mod that allows modifying the getter and setters of a property.
 * The original property descriptor is restored when the mod is uninstalled.
 */
export function registerPropertyOverrideMod<
	Target extends Object,
	Key extends keyof Target,
	Value extends Target[Key],
>(options: PropertyOverrideModOptions<Target, Key, Value>) {
	if (!options.get && !options.set) {
		throw new Error(`At least one of 'get' or 'set' must be provided in a PropertyOverrideMod.`)
	}

	registerMod({
		...options,

		apply: () => {
			if (options.target == undefined) {
				throw new Error(`Cannot override property on undefined object.`)
			}

			let currentValue = options.target[options.key] as Value
			const originalDescriptor = Object.getOwnPropertyDescriptor(
				options.target,
				options.key
			) ?? {
				value: currentValue,
				writable: true,
				configurable: true,
			}

			if (originalDescriptor.configurable === false) {
				throw new Error(
					`Cannot override property '${String(
						options.key
					)}' on object because it is not configurable.`
				)
			}

			const descriptor: PropertyDescriptor = {
				configurable: true,
			}

			if (options.get) {
				let getCondition: ConditionResolvable<{ target: Target; value: Value }> | undefined

				if (options.condition && options.getCondition) {
					getCondition = context => {
						return (
							Condition(options.condition, context) &&
							Condition(options.getCondition, context)
						)
					}
				} else {
					getCondition = options.getCondition ?? options.condition
				}

				if (getCondition) {
					descriptor.get = function (this: Target) {
						if (Condition(getCondition!, { target: this, value: currentValue })) {
							return options.get!.call(this, currentValue)
						}
						return currentValue
					}
				} else {
					descriptor.get = function (this: Target) {
						return options.get!.call(this, currentValue)
					}
				}
			}

			if (options.set) {
				let setCondition: ConditionResolvable<{ target: Target; value: Value }> | undefined

				if (options.condition && options.setCondition) {
					setCondition = context => {
						return (
							Condition(options.condition, context) &&
							Condition(options.setCondition, context)
						)
					}
				} else {
					setCondition = options.setCondition ?? options.condition
				}

				if (setCondition) {
					descriptor.set = function (this: Target, value) {
						if (Condition(setCondition!, { target: this, value })) {
							currentValue = options.set!.call(this, value)
						} else {
							currentValue = value
						}
					}
				} else {
					descriptor.set = function (this: Target, value) {
						currentValue = options.set!.call(this, value)
					}
				}
			}

			Object.defineProperty(options.target, options.key, descriptor)

			return { originalDescriptor }
		},

		revert: ({ originalDescriptor }) => {
			Object.defineProperty(options.target, options.key, originalDescriptor)
		},
	})
}
