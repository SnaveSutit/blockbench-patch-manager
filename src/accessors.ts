import { type Subscribable, subscribable } from 'simple-subpub'

const ACCESSORS_SYMBOL = Symbol('accessors')

declare global {
	interface Object {
		[ACCESSORS_SYMBOL]?: Map<
			string | symbol | number,
			{ onGet: Subscribable<any>; onSet: Subscribable<any> }
		>
	}
}

/**
 * Overrides property accessors on a target object, allowing you to intercept and modify get and set operations.
 *
 * This function creates a subscription-based accessor system that enables multiple callbacks to hook into
 * property access and modification. Each callback receives both the potentially modified value and the original
 * unmodified value before any other accessor callbacks are applied.
 *
 * @returns A cleanup function that:
 *   - Unsubscribes all accessor callbacks.
 *   - Restores the original property descriptor.
 *   - Optionally restores the original property value if `restoreOriginalValue` was true.
 *
 * @throws If the target property is not configurable.
 *
 * @example
 * ```typescript
 * const obj = { count: 0 };
 * const cleanup = overrideAccessors({
 *   target: obj,
 *   key: 'count',
 *   get: (value) => value * 2,
 *   set: (value) => Math.max(0, value),
 * });
 *
 * obj.count = 5;  // Sets to 5
 * console.log(obj.count);  // 10 (5 * 2)
 *
 * obj.count = -5; // Sets to 0 (Math.max(0, -5))
 * console.log(obj.count);  // 0
 *
 * cleanup();  // Restores original behavior
 * ```
 */
export function overrideAccessors<
	Target extends {},
	Key extends keyof Target,
	Value extends Target[Key],
>(options: {
	/** The object whose property is to be overridden. */
	target: Target
	/** The key of the property to override. */
	key: Key
	/**
	 * An optional callback invoked when the property is accessed (read).
	 * @param value The current value of the property, potentially modified by other get callbacks.
	 * @param unmodified The value of the property before any get callbacks are applied.
	 * @returns The value to be returned to the accessor caller.
	 */
	get?: (this: Target, value: Value, unmodified: Value) => Value
	/**
	 * An optional callback invoked when the property is assigned (written).
	 * @param value The new value being set, potentially modified by other set callbacks.
	 * @param unmodified The value being assigned before any set callbacks are applied.
	 * @returns The value to be assigned to the property.
	 */
	set?: (this: Target, value: Value, unmodified: Value) => Value
	/**
	 * If true, restores the original property value when the returned cleanup function is called. Defaults to false.
	 */
	restoreOriginalValue?: boolean
}): () => void {
	const { target, key, get, set, restoreOriginalValue = false } = options

	if (get == undefined && set == undefined) {
		throw new TypeError('At least one of get or set callbacks must be provided')
	}
	if (target == undefined) throw new TypeError('Target is undefined')

	const originalValue = target[key] as Value
	const originalDescriptor = Object.getOwnPropertyDescriptor(target, key) ?? {
		value: originalValue,
		writable: true,
		configurable: true,
	}
	if (originalDescriptor.configurable === false) {
		throw new Error(`Cannot redefine property: ${String(key)} as it is not configurable`)
	}

	const createEntry = () => {
		target[ACCESSORS_SYMBOL] ??= new Map()
		const entry = { onGet: subscribable<Value>(), onSet: subscribable<Value>() }
		target[ACCESSORS_SYMBOL].set(key, entry)
		return entry
	}
	const { onGet, onSet } = target[ACCESSORS_SYMBOL]?.get(key) ?? createEntry()

	// The current value of the property.
	let currentValue = target[key] as Value

	let unsubGet: () => void
	let getReturnValue = currentValue
	if (get) {
		unsubGet = onGet.subscribe(unmodified => {
			getReturnValue = get.call(target, getReturnValue, unmodified)
		})
	}

	let unsubSet: () => void
	let setReturnValue = currentValue
	if (set) {
		unsubSet = onSet.subscribe(unmodified => {
			setReturnValue = set.call(target, setReturnValue, unmodified)
		})
	}

	const overrideDescriptor: PropertyDescriptor = {
		configurable: true,
		get() {
			getReturnValue = currentValue
			onGet.publish(currentValue)
			return getReturnValue
		},
		set(value: Value) {
			setReturnValue = value
			onSet.publish(value)
			currentValue = setReturnValue
		},
	}

	try {
		Object.defineProperty(target, key, overrideDescriptor)
	} catch (e) {
		throw new Error(
			`Failed to override property: ${String(key)}. ${e instanceof Error ? e.message : String(e)}`
		)
	}

	return () => {
		unsubGet?.()
		unsubSet?.()
		try {
			Object.defineProperty(target, key, originalDescriptor)
		} catch (e) {
			throw new Error(
				`Failed to restore original property: ${String(key)}. ${e instanceof Error ? e.message : String(e)}`
			)
		}
		if (restoreOriginalValue) {
			target[key] = originalValue
		}

		const accessorsMap = target[ACCESSORS_SYMBOL]
		if (accessorsMap) {
			const entry = accessorsMap.get(key)
			if (entry?.onGet.subscriberCount === 0 && entry.onSet.subscriberCount === 0) {
				accessorsMap.delete(key)
				if (accessorsMap.size === 0) delete target[ACCESSORS_SYMBOL]
			}
		}
	}
}
