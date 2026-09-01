import {
	registerPatch,
	registerProjectPatch,
	registerPropertyOverridePatch,
	overrideAccessors,
	type PatchHandle,
} from '../../dist/index.js'
import {
	assert,
	assertDeepEqual,
	assertEqual,
	assertThrows,
	delay,
	PLUGIN_ID,
	type TestCase,
	type TestContext,
} from './harness'

const EVENT_HOOK_ID = 'blockbench-patch-manager:event-hook/pre-select-project'

/** ~250ms cooldown in the manager + margin. */
const COOLDOWN_WAIT = 400

interface TrackedPatch {
	handle: PatchHandle
	state: { applyCount: number; revertCount: number }
}

/**
 * Registers a bookkeeping patch through the real `registerPatch` and schedules
 * its removal when the test finishes.
 */
function createPatch(
	ctx: TestContext,
	options: {
		name: string
		priority?: number
		dependencies?: string[]
		timeline?: string[]
		onApply?: () => void
	}
): TrackedPatch {
	const state = { applyCount: 0, revertCount: 0 }
	const handle = registerPatch({
		id: `${PLUGIN_ID}:${options.name}`,
		priority: options.priority,
		dependencies: options.dependencies,
		apply: () => {
			state.applyCount++
			options.timeline?.push(`apply:${options.name}`)
			options.onApply?.()
		},
		revert: () => {
			state.revertCount++
			options.timeline?.push(`revert:${options.name}`)
		},
	})
	trackHandle(ctx, handle)
	return { handle, state }
}

/** Reverts (if applied) and removes a patch handle after the test. */
function trackHandle(ctx: TestContext, handle: PatchHandle) {
	ctx.cleanup(() => {
		try {
			if (handle.isApplied()) handle.revert()
		} catch (error) {
			console.error('[cleanup] revert failed', error)
		}
		try {
			if (BlockbenchPatchManager.registered.get(handle.id) === handle) {
				BlockbenchPatchManager.removePatch(handle.id)
			}
		} catch (error) {
			console.error('[cleanup] removePatch failed', error)
		}
	})
}

export const TESTS: TestCase[] = [
	// ─── Manager basics ──────────────────────────────────────────────────────
	{
		group: 'Manager',
		name: 'global singleton exposes the expected API',
		fn: () => {
			assert(
				typeof BlockbenchPatchManager === 'object' && BlockbenchPatchManager != null,
				'BlockbenchPatchManager global exists'
			)
			const api = BlockbenchPatchManager as unknown as Record<string, unknown>
			for (const method of ['addPatch', 'removePatch', 'updatePatches', 'queuePatchUpdate']) {
				assert(
					typeof api[method] === 'function',
					`BlockbenchPatchManager.${method}() is a function`
				)
			}
			assert(BlockbenchPatchManager.registered instanceof Map, 'registered is a Map')
			assert(Array.isArray(BlockbenchPatchManager.installOrder), 'installOrder is an array')
		},
	},
	{
		group: 'Manager',
		name: 'built-in pre_select_project event hook is registered and applies',
		fn: () => {
			assert(
				BlockbenchPatchManager.registered.has(EVENT_HOOK_ID),
				'event hook patch is registered'
			)
			BlockbenchPatchManager.updatePatches()
			assert(
				BlockbenchPatchManager.registered.get(EVENT_HOOK_ID)!.isApplied(),
				'event hook patch is applied after updatePatches()'
			)
		},
	},

	// ─── Apply / revert lifecycle ────────────────────────────────────────────
	{
		group: 'Lifecycle',
		name: 'a patch applies on updatePatches() and reverts when disabled',
		fn: ctx => {
			const p = createPatch(ctx, { name: 'lifecycle-basic' })
			BlockbenchPatchManager.updatePatches()
			assert(p.handle.isApplied(), 'patch is applied')
			assertEqual(p.state.applyCount, 1, 'apply() ran once')

			p.handle.enabled = false
			BlockbenchPatchManager.updatePatches()
			assert(!p.handle.isApplied(), 'patch is reverted after being disabled')
			assertEqual(p.state.revertCount, 1, 'revert() ran once')
		},
	},
	{
		group: 'Lifecycle',
		name: 'a disabled patch is never applied',
		fn: ctx => {
			const p = createPatch(ctx, { name: 'lifecycle-disabled' })
			p.handle.enabled = false
			BlockbenchPatchManager.updatePatches()
			assert(!p.handle.isApplied(), 'disabled patch stays unapplied')
			assertEqual(p.state.applyCount, 0, 'apply() never ran')
		},
	},

	// ─── Ordering ────────────────────────────────────────────────────────────
	{
		group: 'Ordering',
		name: 'higher priority patches apply first',
		fn: ctx => {
			const timeline: string[] = []
			createPatch(ctx, { name: 'prio-low', priority: -10, timeline })
			createPatch(ctx, { name: 'prio-high', priority: 10, timeline })
			createPatch(ctx, { name: 'prio-mid', priority: 0, timeline })
			BlockbenchPatchManager.updatePatches()
			assertDeepEqual(
				timeline.filter(e => e.startsWith('apply:')),
				['apply:prio-high', 'apply:prio-mid', 'apply:prio-low'],
				'apply order follows descending priority'
			)
		},
	},
	{
		group: 'Ordering',
		name: 'a dependency applies before its dependent despite lower priority',
		fn: ctx => {
			const timeline: string[] = []
			createPatch(ctx, { name: 'dep-base', priority: -100, timeline })
			createPatch(ctx, {
				name: 'dep-main',
				priority: 100,
				dependencies: [`${PLUGIN_ID}:dep-base`],
				timeline,
			})
			BlockbenchPatchManager.updatePatches()
			const applies = timeline.filter(e => e.startsWith('apply:'))
			assert(
				applies.indexOf('apply:dep-base') < applies.indexOf('apply:dep-main'),
				`dependency applied before dependent (order: ${applies.join(', ')})`
			)
		},
	},
	{
		group: 'Ordering',
		name: 'patches revert in the reverse of their apply order',
		fn: ctx => {
			const timeline: string[] = []
			createPatch(ctx, { name: 'rev-a', priority: 30, timeline })
			createPatch(ctx, { name: 'rev-b', priority: 20, timeline })
			createPatch(ctx, { name: 'rev-c', priority: 10, timeline })
			BlockbenchPatchManager.updatePatches()
			timeline.length = 0
			// A second pass reverts every applied patch then re-applies them.
			BlockbenchPatchManager.updatePatches()
			assertDeepEqual(
				timeline.filter(e => e.startsWith('revert:')),
				['revert:rev-c', 'revert:rev-b', 'revert:rev-a'],
				'revert order is the reverse of apply order'
			)
			assertDeepEqual(
				timeline.filter(e => e.startsWith('apply:')),
				['apply:rev-a', 'apply:rev-b', 'apply:rev-c'],
				're-apply order still follows priority'
			)
		},
	},

	// ─── Registration ────────────────────────────────────────────────────────
	{
		group: 'Registration',
		name: 'registering a duplicate id replaces the previous handle',
		fn: ctx => {
			const id = `${PLUGIN_ID}:dupe`
			const first = registerPatch({ id, apply: () => {}, revert: () => {} })
			ctx.cleanup(() => {
				try {
					if (BlockbenchPatchManager.registered.get(id) === first) {
						BlockbenchPatchManager.removePatch(id)
					}
				} catch (error) {
					console.error(error)
				}
			})
			BlockbenchPatchManager.updatePatches()
			assert(first.isApplied(), 'first handle is applied')

			const second = registerPatch({ id, apply: () => {}, revert: () => {} })
			trackHandle(ctx, second)

			assert(!first.isApplied(), 'first handle was reverted when replaced')
			assertEqual(
				BlockbenchPatchManager.registered.get(id),
				second,
				'registry now points at the second handle'
			)
			assertEqual(
				BlockbenchPatchManager.installOrder.filter(p => p === id).length,
				1,
				'install order has exactly one entry for the id'
			)
		},
	},
	{
		group: 'Registration',
		name: 'registering a patch with an unknown dependency throws',
		fn: ctx => {
			const id = `${PLUGIN_ID}:orphan-dep`
			ctx.cleanup(() => {
				try {
					BlockbenchPatchManager.removePatch(id)
				} catch {
					/* may never have registered */
				}
			})
			assertThrows(
				() =>
					registerPatch({
						id,
						dependencies: [`${PLUGIN_ID}:ghost`],
						apply: () => {},
						revert: () => {},
					}),
				'registerPatch rejects an unknown dependency',
				/depends on unknown patch/
			)
		},
	},
	{
		group: 'Registration',
		name: 'removePatch throws while the patch is still applied',
		fn: ctx => {
			const p = createPatch(ctx, { name: 'remove-guard' })
			BlockbenchPatchManager.updatePatches()
			assert(p.handle.isApplied(), 'patch is applied')
			assertThrows(
				() => BlockbenchPatchManager.removePatch(p.handle.id),
				'removePatch refuses an applied patch',
				/still applied/
			)
		},
	},

	// ─── Error wrapping ──────────────────────────────────────────────────────
	{
		group: 'Errors',
		name: 'errors thrown in apply() are wrapped',
		fn: ctx => {
			const id = `${PLUGIN_ID}:throw-apply`
			const handle = registerPatch({
				id,
				apply: () => {
					throw new Error('boom-apply')
				},
				revert: () => {},
			})
			ctx.cleanup(() => {
				try {
					BlockbenchPatchManager.removePatch(id)
				} catch (error) {
					console.error(error)
				}
			})
			const err = assertThrows(
				() => handle.apply(),
				'apply() surfaces an error',
				/failed to apply/
			)
			assert(/boom-apply/.test(err.message), 'wrapped error keeps the original message')
			assert(!handle.isApplied(), 'patch is not marked applied after a failed apply')
		},
	},
	{
		group: 'Errors',
		name: 'reverting before applying throws',
		fn: ctx => {
			const id = `${PLUGIN_ID}:revert-early`
			const handle = registerPatch({ id, apply: () => {}, revert: () => {} })
			trackHandle(ctx, handle)
			assertThrows(
				() => handle.revert(),
				'revert() before apply() is rejected',
				/before it was applied/
			)
		},
	},

	// ─── Debounced updates ───────────────────────────────────────────────────
	{
		group: 'Debounce',
		name: 'queuePatchUpdate() applies immediately on the leading edge',
		fn: async ctx => {
			const p = createPatch(ctx, { name: 'debounce-leading' })
			assert(!p.handle.isApplied(), 'patch not applied before queuing')
			BlockbenchPatchManager.queuePatchUpdate()
			assert(
				p.handle.isApplied(),
				'patch applied synchronously after the first queuePatchUpdate()'
			)
			await delay(COOLDOWN_WAIT)
		},
	},
	{
		group: 'Debounce',
		name: 'a burst of queuePatchUpdate() calls collapses to one leading + one trailing run',
		fn: async ctx => {
			const original = BlockbenchPatchManager.updatePatches.bind(BlockbenchPatchManager)
			let calls = 0
			const manager = BlockbenchPatchManager as { updatePatches: () => void }
			manager.updatePatches = () => {
				calls++
				original()
			}
			ctx.cleanup(() => {
				delete (manager as Partial<typeof manager>).updatePatches
			})

			createPatch(ctx, { name: 'debounce-burst' })
			BlockbenchPatchManager.queuePatchUpdate()
			BlockbenchPatchManager.queuePatchUpdate()
			BlockbenchPatchManager.queuePatchUpdate()
			BlockbenchPatchManager.queuePatchUpdate()
			assertEqual(calls, 1, 'exactly one synchronous (leading) update')

			await delay(COOLDOWN_WAIT)
			assertEqual(calls, 2, 'one trailing update after the cooldown elapses')

			await delay(COOLDOWN_WAIT)
			assertEqual(calls, 2, 'no further updates once things go quiet')
		},
	},
	{
		group: 'Debounce',
		name: 'the trailing update reflects the final enable/disable state',
		fn: async ctx => {
			const a = createPatch(ctx, { name: 'debounce-final-a' })
			BlockbenchPatchManager.queuePatchUpdate()
			assert(a.handle.isApplied(), 'A applied on the leading edge')

			const b = createPatch(ctx, { name: 'debounce-final-b' })
			a.handle.enabled = false
			BlockbenchPatchManager.queuePatchUpdate()

			await delay(COOLDOWN_WAIT)
			assert(!a.handle.isApplied(), 'A reverted by the trailing update after being disabled')
			assert(b.handle.isApplied(), 'B applied by the trailing update')
		},
	},
	{
		group: 'Debounce',
		name: 'an apply() that re-enters queuePatchUpdate() does not recurse forever',
		fn: async ctx => {
			let applyCount = 0
			const id = `${PLUGIN_ID}:reentrant`
			const handle = registerPatch({
				id,
				apply: () => {
					applyCount++
					if (applyCount < 3) BlockbenchPatchManager.queuePatchUpdate()
				},
				revert: () => {},
			})
			ctx.cleanup(() => {
				try {
					if (handle.isApplied()) handle.revert()
				} catch (error) {
					console.error(error)
				}
				try {
					BlockbenchPatchManager.removePatch(id)
				} catch (error) {
					console.error(error)
				}
			})

			BlockbenchPatchManager.queuePatchUpdate()
			assert(handle.isApplied(), 'patch applied on the leading edge')
			await delay(COOLDOWN_WAIT * 5)
			assert(handle.isApplied(), 'patch still applied once the cooldown settles')
			assert(applyCount < 10, `apply() did not run away (ran ${applyCount}×)`)
		},
	},

	// ─── Property override patches ───────────────────────────────────────────
	{
		group: 'Property override',
		name: 'registerPropertyOverridePatch swaps the getter and restores it on revert',
		fn: ctx => {
			const target: { value: number } = { value: 1 }
			const id = `${PLUGIN_ID}:prop-get`
			registerPropertyOverridePatch({ id, target, key: 'value', get: () => 42 })
			const handle = BlockbenchPatchManager.registered.get(id)!
			trackHandle(ctx, handle)

			BlockbenchPatchManager.updatePatches()
			assertEqual(target.value, 42, 'getter override is active')

			handle.enabled = false
			BlockbenchPatchManager.updatePatches()
			assertEqual(target.value, 1, 'original value is restored after revert')
			assert(
				!('get' in Object.getOwnPropertyDescriptor(target, 'value')!),
				'original data descriptor is restored'
			)
		},
	},
	{
		group: 'Property override',
		name: 'a non-enumerable property stays non-enumerable through apply and revert',
		fn: ctx => {
			const target = {} as { hidden: number }
			Object.defineProperty(target, 'hidden', {
				value: 5,
				enumerable: false,
				writable: true,
				configurable: true,
			})
			const id = `${PLUGIN_ID}:prop-enumerable`
			registerPropertyOverridePatch({ id, target, key: 'hidden', get: value => value })
			const handle = BlockbenchPatchManager.registered.get(id)!
			trackHandle(ctx, handle)

			BlockbenchPatchManager.updatePatches()
			assertEqual(
				Object.getOwnPropertyDescriptor(target, 'hidden')!.enumerable,
				false,
				'override keeps enumerable: false'
			)

			handle.enabled = false
			BlockbenchPatchManager.updatePatches()
			const restored = Object.getOwnPropertyDescriptor(target, 'hidden')!
			assertEqual(restored.enumerable, false, 'restored descriptor keeps enumerable: false')
			assertEqual(restored.value, 5, 'restored descriptor keeps the original value')
		},
	},

	// ─── Low-level accessor overrides ────────────────────────────────────────
	{
		group: 'Accessors',
		name: 'overrideAccessors transforms reads and fully restores on cleanup',
		fn: () => {
			const target: { n: number } = { n: 5 }
			const cleanup = overrideAccessors({ target, key: 'n', get: value => value * 2 })
			try {
				assertEqual(target.n, 10, 'getter override doubles the value')
			} finally {
				cleanup()
			}
			assertEqual(target.n, 5, 'value is restored after cleanup')
			const descriptor = Object.getOwnPropertyDescriptor(target, 'n')!
			assert(
				'value' in descriptor && !('get' in descriptor),
				'the original data descriptor is restored'
			)
		},
	},
	{
		group: 'Accessors',
		name: 'stacked overrideAccessors calls chain and unwind cleanly',
		fn: () => {
			const target: { n: number } = { n: 1 }
			const cleanupA = overrideAccessors({ target, key: 'n', get: value => value + 10 })
			let cleanupB: (() => void) | undefined = overrideAccessors({
				target,
				key: 'n',
				get: value => value + 100,
			})
			try {
				assert(target.n > 100, `both overrides participate in the read (got ${target.n})`)
				cleanupB()
				cleanupB = undefined
				assert(
					target.n >= 11 && target.n < 100,
					`only the first override remains after removing the second (got ${target.n})`
				)
			} finally {
				cleanupB?.()
				cleanupA()
			}
			assertEqual(target.n, 1, 'the original value is restored after all cleanups')
		},
	},

	// ─── Project patches ─────────────────────────────────────────────────────
	{
		group: 'Project patches',
		name: 'registerProjectPatch reacts to pre_select_project / unselect_project',
		fn: ctx => {
			let applied = 0
			let reverted = 0
			const id = `${PLUGIN_ID}:project`
			const handle = registerProjectPatch({
				id,
				condition: () => true,
				apply: () => {
					applied++
				},
				revert: () => {
					reverted++
				},
			})
			trackHandle(ctx, handle)

			BlockbenchPatchManager.updatePatches()
			assert(handle.isApplied(), 'the project patch parent is applied (listeners attached)')

			Blockbench.dispatchEvent(
				'blockbench-patch-manager:pre_select_project',
				{} as unknown as ModelProject
			)
			assertEqual(applied, 1, 'apply ran when a project was selected')

			Blockbench.dispatchEvent('unselect_project', {} as never)
			assertEqual(reverted, 1, 'revert ran when the project was deselected')
		},
	},
]
