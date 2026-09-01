import { beforeAll, describe, expect, it } from '@jest/globals'
import { blockbench } from '@snavesutit/jestbench'

/**
 * End-to-end suite for the patch manager.
 *
 * The heavy lifting lives in the in-app test plugin (`test/src/**`), which
 * exercises the live `BlockbenchPatchManager` — timers, accessor swaps, event
 * hooks, re-entrancy — none of which survive a trip across the CDP bridge. Here
 * we load that plugin into a real Blockbench, run its suite once, and turn each
 * result into a Jest assertion so failures show up per group in CI.
 */

interface TestResult {
	group: string
	name: string
	passed: boolean
	error?: string
	durationMs: number
}

/** Groups defined in `test/src/tests.ts`, in declaration order. */
const GROUPS = [
	'Manager',
	'Lifecycle',
	'Ordering',
	'Registration',
	'Errors',
	'Debounce',
	'Property override',
	'Accessors',
	'Project patches',
] as const

let results: TestResult[] = []

beforeAll(async () => {
	expect(await blockbench.loadedPlugins()).toContain('bb_patch_manager_test')
	await blockbench.waitFor(
		() =>
			typeof (globalThis as unknown as { runPatchManagerTests?: unknown })
				.runPatchManagerTests === 'function',
		10_000,
	)
	results = (await blockbench.evaluate(async () => {
		const run = (
			globalThis as unknown as {
				runPatchManagerTests: (o?: { report?: boolean }) => Promise<unknown>
			}
		).runPatchManagerTests
		return run({ report: false })
	})) as TestResult[]
}, 120_000)

it('runs the in-app suite and returns results', () => {
	expect(Array.isArray(results)).toBe(true)
	expect(results.length).toBeGreaterThan(0)
})

it('every result belongs to a known group (tests.ts and this file are in sync)', () => {
	const seen = new Set(results.map(r => r.group))
	expect([...seen].sort()).toEqual([...GROUPS].sort())
})

describe.each(GROUPS)('%s', group => {
	it('all checks pass', () => {
		const groupResults = results.filter(r => r.group === group)
		expect(groupResults.length).toBeGreaterThan(0)

		const failed = groupResults.filter(r => !r.passed)
		if (failed.length > 0) {
			throw new Error(
				`${failed.length}/${groupResults.length} check(s) failed:\n\n` +
					failed.map(f => `• ${f.name}\n${indent(f.error ?? 'unknown error')}`).join('\n\n'),
			)
		}
	})
})

function indent(text: string): string {
	return text
		.split('\n')
		.map(line => `    ${line}`)
		.join('\n')
}
