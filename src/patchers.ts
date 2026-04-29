import subscribable, { Subscribable } from 'simple-subpub'
import { PatchApplyError, PatchRevertError } from './errors'
import { updatePatchApplicationOrder, validatePatchId } from './manager'
import { prettyLog } from './log'

export interface PatchHandle {
	id: string
	dependencies?: string[]
	priority: number
	enabled: boolean
	isInstalled(): boolean
	apply: () => Promise<void>
	revert: () => Promise<void>
}

export interface BasePatchOptions {
	/**
	 * The unique identifier for the patch. E.g: 'animated-java:example_patch'
	 * The namespace MUST match your plugin's ID.
	 */
	id: string
	/**
	 * A list of patch IDs that this patch depends on.
	 * - If any of these patches are not installed, this patch will not be installed either.
	 * - All of these patches will be installed before this patch, regardless of their priority.
	 */
	dependencies?: string[]
	/** The priority of the patch. Higher priority patches will be installed first. */
	priority?: number
}

interface PatchOptions<RevertContext extends any | void> extends BasePatchOptions {
	/** A function that applies the patch. This function should return a context object that will be passed to the revert function. */
	apply: () => Promise<RevertContext> | RevertContext
	/**
	 * A function that reverts the patch
	 * @param ctx The context object returned by the apply function
	 */
	revert: (ctx: RevertContext) => Promise<void> | void
}

/**
 * Registers a new patch. Patches are changes that need to be applied when the plugin is loaded, and reverted when the plugin is unloaded.
 *
 * Patches can depend on other patches, and will be installed in the correct order.
 *
 * If a patch fails to install, an error will be thrown, and the plugin will fail to load.
 */
export function registerPatch<RevertContext extends any | void>(
	options: PatchOptions<RevertContext>
) {
	if (!validatePatchId(options.id)) {
		throw new Error(
			`Failed to register patch with invalid ID '${options.id}'. See previous warnings for more details.`
		)
	}

	let applyContext: RevertContext
	let installed = false

	if (BlockbenchPatchManager.registered.has(options.id)) {
		throw new Error(`A Patch with the ID '${options.id}' is already registered!`)
	}

	const handle: PatchHandle = {
		id: options.id,
		dependencies: options.dependencies,
		priority: options.priority ?? 0,
		enabled: true,

		isInstalled() {
			return installed
		},

		async apply() {
			if (!this.enabled) return
			prettyLog({ 'Applying ': 'color: #55ff55;', [options.id]: 'color: #ffff55;' })
			try {
				if (installed)
					throw new Error(
						`Attempted to apply '${options.id}' while it was already applied.`
					)
				applyContext = await options.apply()
				installed = true
			} catch (err) {
				debugger
				throw new PatchApplyError(options.id, err as Error)
			}
		},

		async revert() {
			if (!this.enabled && !installed) return
			prettyLog({ 'Reverting ': 'color: #ff5555;', [options.id]: 'color: #ffff55;' })
			try {
				if (!installed)
					throw new Error(`Attempted to revert '${options.id}' before it was applied.`)
				await options.revert(applyContext)
				installed = false
			} catch (err) {
				debugger
				throw new PatchRevertError(options.id, err as Error)
			}
		},
	}

	BlockbenchPatchManager.registered.set(options.id, handle)
	BlockbenchPatchManager.installOrder.push(options.id)
	updatePatchApplicationOrder()

	return handle
}

interface RegisterProjectPatchOptions<
	RevertContext extends any | void,
> extends PatchOptions<RevertContext> {
	/** A function that checks if the patch should be applied when switching projects */
	condition: ConditionResolvable<{ project: ModelProject }>
	apply: () => RevertContext
	revert: (ctx: RevertContext) => void
	/**
	 * If true, the patch will be reverted (and re-applied) when switching to a different project, even if the new project also meets the condition for applying the patch.
	 */
	alwaysRevertOnProjectChange?: boolean
}

/**
 * Registers a patch that is only applied when a project is selected that meets the provided condition.
 *
 * Used to apply patches that are specific to a custom model format.
 *
 * NOTE: The `apply` and `revert` functions of this patch are not awaited.
 */
export function registerProjectPatch<RevertContext extends any | void>(
	options: RegisterProjectPatchOptions<RevertContext>
) {
	let revertContext: RevertContext | null = null
	let parentPatchHandle: PatchHandle
	options.alwaysRevertOnProjectChange ??= false

	let isApplied = false

	const onPreSelectProject = (project: ModelProject) => {
		if (isApplied) return
		if (!Condition(options.condition, { project })) return
		prettyLog({ 'Applying project patch ': 'color: #55ff55;', [options.id]: 'color: #ffff55;' })
		revertContext = options.apply()
		isApplied = true
	}

	const onUnselectProject = () => {
		if (!isApplied) return
		prettyLog({
			'Reverting project patch ': 'color: #ff5555;',
			[options.id]: 'color: #ffff55;',
		})
		options.revert(revertContext!)
		revertContext = null
		isApplied = false
	}

	// eslint-disable-next-line prefer-const
	parentPatchHandle = registerPatch({
		...options,

		apply: () => {
			Blockbench.on('blockbench-patch-manager:pre_select_project', onPreSelectProject)
			Blockbench.on('unselect_project', onUnselectProject)
		},

		revert: () => {
			Blockbench.removeListener(
				'blockbench-patch-manager:pre_select_project',
				onPreSelectProject
			)
			Blockbench.removeListener('unselect_project', onUnselectProject)
		},
	})

	return parentPatchHandle
}

interface RegisterPluginPatchOptions<
	RevertContext extends any | void,
> extends PatchOptions<RevertContext> {
	apply: () => RevertContext
	revert: (ctx: RevertContext) => void
	/** A function that checks if the patch should be applied when the plugin is loaded */
	condition: (plugin: BBPlugin) => boolean
}

/**
 * Registers a patch that is applied / reverted when a plugin is loaded / unloaded that meets the provided condition.
 */
export function registerPluginPatch<RevertContext extends any | void>(
	options: RegisterPluginPatchOptions<RevertContext>
) {
	let revertContext: RevertContext | undefined

	const onLoadedPlugin = ({ plugin }: { plugin: BBPlugin }) => {
		if (!Condition(options.condition, plugin)) return
		prettyLog({ 'Applying plugin patch ': 'color: #55ff55;', [options.id]: 'color: #ffff55;' })
		revertContext = options.apply()
	}

	const onUnloadedPlugin = () => {
		// Effectively using revertContext as a boolean to check if the patch is applied
		if (revertContext !== undefined) {
			prettyLog({
				'Reverting plugin patch ': 'color: #ff5555;',
				[options.id]: 'color: #ffff55;',
			})
			options.revert(revertContext)
			revertContext = undefined
		}
	}

	return registerPatch({
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

interface RegisterDeletableOptions<T extends Deletable> extends BasePatchOptions {
	create: () => T
}

/**
 * Registers a patch that handles the creation and deletion of a {@link Deletable} object on plugin load and unload.
 */
export function registerDeletableHandlerPatch<T extends Deletable>(
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

	registerPatch({
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

interface PropertyOverridePatchOptions<
	Target extends Object,
	Key extends keyof Target,
	Value extends Target[Key],
> extends BasePatchOptions {
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
 * Registers a patch that allows modifying the getter and setters of a property.
 * The original property descriptor is restored when the patch is uninstalled.
 */
export function registerPropertyOverridePatch<
	Target extends Object,
	Key extends keyof Target,
	Value extends Target[Key],
>(options: PropertyOverridePatchOptions<Target, Key, Value>) {
	if (!options.get && !options.set) {
		throw new Error(
			`At least one of 'get' or 'set' must be provided in a PropertyOverridePatch.`
		)
	}

	registerPatch({
		...options,

		apply: () => {
			if (options.target == undefined) {
				throw new Error(`Cannot override property on undefined object.`)
			}

			let currentValue: Value
			try {
				currentValue = options.target[options.key] as Value
			} catch {
				throw new Error(
					`Failed to get initial value of property '${String(options.key)}' for PropertyOverridePatch ${String(options.id)}.`
				)
			}

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
