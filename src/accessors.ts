/**
 * Overrides the getter and setter of a property on a target object with custom callbacks.
 * The original property descriptor is preserved and can be restored later.
 * @returns A function that, when called, restores the original property descriptor.
 * @throws Will throw an error if the target is undefined or if the property is not configurable.
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
	/** An optional callback to be called when the property is accessed. It receives the current value and should return the value to be returned. */
	get?: (this: Target, value: Value) => Value
	/** An optional callback to be called when the property is set. It receives the new value and should return the value to be set. */
	set?: (this: Target, value: Value) => Value
	/** An optional flag indicating whether to restore the original value when restoring the property descriptor. */
	restoreOriginalValue?: boolean
}): () => void {
	const { target, key, get, set, restoreOriginalValue = false } = options

	if (target == undefined) {
		throw new Error('Target is undefined')
	}

	const originalValue = target[key] as Value
	const originalDescriptor = Object.getOwnPropertyDescriptor(target, key) ?? {
		value: originalValue,
		writable: true,
		configurable: true,
	}

	let currentValue = target[key] as Value

	if (originalDescriptor.configurable === false) {
		throw new Error(`Cannot redefine property: ${String(key)} as it is not configurable`)
	}

	const descriptor: PropertyDescriptor = {
		configurable: true,
		get() {
			return get ? get.call(target, currentValue) : currentValue
		},
		set(value: Value) {
			currentValue = set ? set.call(target, value) : value
		},
	}

	try {
		Object.defineProperty(target, key, descriptor)
	} catch (e) {
		throw new Error(
			`Failed to override property: ${String(key)}. ${e instanceof Error ? e.message : String(e)}`
		)
	}

	return () => {
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
	}
}
