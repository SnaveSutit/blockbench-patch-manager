/**
 * Minimal in-browser test harness for the patch-manager test plugin.
 *
 * No external test runner — this bundles into a Blockbench plugin that runs a
 * suite of assertions against the live `BlockbenchPatchManager` and reports the
 * results to the console and a message box.
 */

/** Plugin id — also the namespace every test patch is registered under. */
export const PLUGIN_ID = 'bb_patch_manager_test'

export class AssertionError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'AssertionError'
	}
}

export function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new AssertionError(message)
}

export function assertEqual<T>(actual: T, expected: T, message: string) {
	if (actual !== expected) {
		throw new AssertionError(
			`${message}\n      expected: ${format(expected)}\n      actual:   ${format(actual)}`
		)
	}
}

export function assertDeepEqual(actual: unknown, expected: unknown, message: string) {
	const a = JSON.stringify(actual)
	const e = JSON.stringify(expected)
	if (a !== e) {
		throw new AssertionError(`${message}\n      expected: ${e}\n      actual:   ${a}`)
	}
}

/**
 * Asserts that `fn` throws. Returns the thrown error so the caller can make
 * further assertions about it. If `matcher` is provided, the error message must
 * match it.
 */
export function assertThrows(fn: () => unknown, message: string, matcher?: RegExp): Error {
	try {
		fn()
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error))
		if (matcher && !matcher.test(err.message)) {
			throw new AssertionError(
				`${message}\n      thrown message ${JSON.stringify(
					err.message
				)} did not match ${String(matcher)}`
			)
		}
		return err
	}
	throw new AssertionError(`${message}\n      expected the function to throw, but it did not`)
}

export function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function format(value: unknown): string {
	if (typeof value === 'string') return JSON.stringify(value)
	if (typeof value === 'object' && value !== null) return JSON.stringify(value)
	return String(value)
}

export interface TestContext {
	/** Registers a cleanup callback. Cleanups run in LIFO order after the test, even on failure. */
	cleanup(fn: () => void): void
}

export interface TestCase {
	group: string
	name: string
	fn: (ctx: TestContext) => void | Promise<void>
}

export interface TestResult {
	group: string
	name: string
	passed: boolean
	error?: string
	durationMs: number
}
