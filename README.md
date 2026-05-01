# Blockbench Patch Manager

A unified lifecycle-aware monkey-patch management framework for [Blockbench](https://blockbench.net) plugins.

Blockbench plugins often need to override internal methods, inject event listeners, or manage stateful objects that must be created on load and destroyed on unload. Doing this reliably — especially with multiple plugins interacting — is error-prone. `blockbench-patch-manager` provides a structured system to register, prioritize, and cleanly revert runtime patches.

---

## ✨ Features

- **Lifecycle management** — patches are automatically applied and reverted when your plugin loads/unloads
- **Dependency ordering** — declare which patches must run before yours; the manager handles topological sorting
- **Priority system** — fine-tune installation order with numeric priorities
- **Project-conditional patches** — apply a patch only when a specific project type is active
- **Plugin-conditional patches** — apply a patch only when another specific plugin is loaded
- **Deletable object management** — manage Blockbench `Deletable` instances with a clean reactive API
- **Property accessor overrides** — safely override getters/setters with automatic restore on revert
- **Global singleton** — one shared `BlockbenchPatchManager` instance is safe to use across multiple plugins

---

## 📦 Installation

```sh
npm install blockbench-patch-manager
```

---

## 🚀 Usage

### 🔧 Basic patch

The core primitive. Provide an `apply` function that returns a revert context, and a `revert` function that receives it.

```typescript
import { registerPatch } from 'blockbench-patch-manager'

registerPatch({
	id: 'my-plugin:my-patch', // namespace must match your plugin ID
	apply() {
		const original = SomeClass.prototype.someMethod
		SomeClass.prototype.someMethod = function (...args) {
			// custom behavior
			return original.apply(this, args)
		}
		return original // returned value becomes the revert context
	},
	revert(original) {
		SomeClass.prototype.someMethod = original
	},
})
```

### 📂 Project-conditional patch

Applied when a project matching `condition` is selected, and reverted when the project is deselected.

```typescript
import { registerProjectPatch } from 'blockbench-patch-manager'

registerProjectPatch({
	id: 'my-plugin:bedrock-patch',
	condition: { formats: ['bedrock_block'] },
	apply() {
		// set up project-specific behavior
	},
	revert() {
		// clean up project-specific behavior
	},
})
```

Set `alwaysRevertOnProjectChange: true` to force a revert+reapply on every project switch, even if the condition still passes.

### 🔌 Plugin-conditional patch

Applied when a target plugin satisfying `condition` is loaded, and reverted when it is unloaded.

```typescript
import { registerPluginPatch } from 'blockbench-patch-manager'

registerPluginPatch({
	id: 'my-plugin:compat-patch',
	condition: plugin => plugin.id === 'some-other-plugin',
	apply() {
		// compatibility shim
	},
	revert() {
		// remove shim
	},
})
```

### 🗑️ Deletable object handler

Manages the lifecycle of a Blockbench `Deletable` (actions, formats, codecs, etc.). The object is created on `apply` and deleted on `revert`.

```typescript
import { registerDeletableHandlerPatch } from 'blockbench-patch-manager'

const myAction = registerDeletableHandlerPatch({
	id: 'my-plugin:my-action',
	create: () => {
		const action = new Action('my-plugin:my-action', {
			name: 'My Action',
			click() {
				/* ... */
			},
		})

		MenuBar.menus.edit.addAction(action, -1)
		return action
	},
})

// Access the live instance (null if not currently applied)
myAction.get()

// React to creation/deletion
myAction.onCreated(action => {
	MenuBar.menus.file.addAction(action, -1)
})
myAction.onDeleted(action => {
	action.removeFromAllMenus()
})
```

### 🔀 Property accessor override

Overrides a getter and/or setter on any object with automatic restore on revert.

```typescript
import { registerPropertyOverridePatch } from 'blockbench-patch-manager'

registerPropertyOverridePatch({
	id: 'my-plugin:locked-override',
	target: Format,
	key: 'rotate_cubes',
	condition: { formats: ['my_format'] },
	get(_value) {
		return true // always report rotate_cubes as enabled
	},
})
```

`condition`, `getCondition`, and `setCondition` are all `ConditionResolvable` and evaluated at call time.

### ⚙️ Lower-level accessor utility

`overrideAccessors` gives direct control over a property's get/set chain without going through the patch lifecycle. Returns a cleanup function.

```typescript
import { overrideAccessors } from 'blockbench-patch-manager'

const cleanup = overrideAccessors({
	target: someObject,
	key: 'someProperty',
	get(value, unmodified) {
		return transform(value)
	},
	set(value, unmodified) {
		return validate(value)
	},
})

// Later:
cleanup() // restores original descriptor and removes this override
```

Multiple `overrideAccessors` calls on the same property are chained — each callback receives the value as modified by the previous override.

---

## 📖 API Reference

### `registerPatch(options)`

| Option         | Type                                            | Description                                                                      |
| -------------- | ----------------------------------------------- | -------------------------------------------------------------------------------- |
| `id`           | `string`                                        | Unique patch ID in `namespace:name` format. Namespace must match your plugin ID. |
| `dependencies` | `string[]`                                      | IDs of patches that must be applied before this one.                             |
| `priority`     | `number`                                        | Higher values are applied first. Defaults to `0`.                                |
| `apply`        | `() => RevertContext \| Promise<RevertContext>` | Called when the patch should be applied. Return value is passed to `revert`.     |
| `revert`       | `(ctx: RevertContext) => void \| Promise<void>` | Called to undo the patch. Receives the value returned by `apply`.                |

Returns a `PatchHandle`.

---

### `registerProjectPatch(options)`

Extends `registerPatch` options with:

| Option                        | Type                  | Description                                                             |
| ----------------------------- | --------------------- | ----------------------------------------------------------------------- |
| `condition`                   | `ConditionResolvable` | Evaluated against the active project on project change.                 |
| `alwaysRevertOnProjectChange` | `boolean`             | If `true`, revert+reapply on every project switch. Defaults to `false`. |

`apply` and `revert` must be synchronous.

---

### `registerPluginPatch(options)`

Extends `registerPatch` options with:

| Option      | Type                            | Description                                               |
| ----------- | ------------------------------- | --------------------------------------------------------- |
| `condition` | `(plugin: BBPlugin) => boolean` | Return `true` to activate the patch for the given plugin. |

`apply` and `revert` must be synchronous.

---

### `registerDeletableHandlerPatch(options)`

Extends base patch options with:

| Option   | Type      | Description                                                 |
| -------- | --------- | ----------------------------------------------------------- |
| `create` | `() => T` | Factory function called on apply to create the `Deletable`. |

Returns a `DeletableEventHandler<T>`:

| Member                | Description                                                  |
| --------------------- | ------------------------------------------------------------ |
| `get()`               | Returns the current live instance, or `null` if not applied. |
| `onCreated(callback)` | Subscribe to creation events.                                |
| `onDeleted(callback)` | Subscribe to deletion events.                                |

---

### `registerPropertyOverridePatch(options)`

| Option         | Type                                    | Description                                   |
| -------------- | --------------------------------------- | --------------------------------------------- |
| `target`       | `object`                                | The object whose property will be overridden. |
| `key`          | `keyof Target`                          | The property to override.                     |
| `condition`    | `ConditionResolvable`                   | Guards both get and set.                      |
| `getCondition` | `ConditionResolvable`                   | Guards only the getter.                       |
| `setCondition` | `ConditionResolvable`                   | Guards only the setter.                       |
| `get`          | `(this: Target, value: Value) => Value` | Custom getter.                                |
| `set`          | `(this: Target, value: Value) => Value` | Custom setter.                                |

---

### `overrideAccessors(options)`

| Option                 | Type                           | Description                                            |
| ---------------------- | ------------------------------ | ------------------------------------------------------ |
| `target`               | `object`                       | Target object.                                         |
| `key`                  | `keyof Target`                 | Property to intercept.                                 |
| `get`                  | `(value, unmodified) => Value` | Override for reads.                                    |
| `set`                  | `(value, unmodified) => Value` | Override for writes.                                   |
| `restoreOriginalValue` | `boolean`                      | If `true`, restores the pre-override value on cleanup. |

Returns `() => void` — call to unsubscribe and restore the original descriptor.

---

## 📡 Global events

`blockbench-patch-manager` dispatches a custom Blockbench event before a project's editor state is loaded:

```typescript
Blockbench.on('blockbench-patch-manager:pre_select_project', project => {
	// runs before the project editor state is fully active
})
```

This is used internally by `registerProjectPatch` to apply patches at the right moment in the project selection lifecycle.

---

## 🚨 Error handling

Errors thrown inside `apply` or `revert` callbacks are wrapped and rethrown:

| Error class        | When thrown                       |
| ------------------ | --------------------------------- |
| `PatchApplyError`  | User's `apply()` function throws  |
| `PatchRevertError` | User's `revert()` function throws |

Both include the patch `id` and the original error's message and stack for easy diagnosis.

---

## 🔍 How it works

A singleton `BlockbenchPatchManager` instance is created on `window` the first time the module loads. It:

1. Maintains a registry of all `PatchHandle` instances
2. Listens to `loaded_plugin` / `unloaded_plugin` events, enabling or disabling patches that belong to those plugins
3. After each change, debounces a `updatePatches()` call (250 ms) that reverts all installed patches in reverse order, re-sorts by priority and dependency, then re-applies all enabled patches in the new order

This ensures correct behavior even when multiple plugins with interdependent patches load and unload at runtime.
