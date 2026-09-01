import { delay, PLUGIN_ID, type TestCase, type TestContext, type TestResult } from './harness'
import { TESTS } from './tests'

const LOG_PREFIX = '%c[Patch Manager Tests]%c'
const LOG_STYLE = ['color: #00aced; font-weight: bold;', 'color: inherit;']

async function runTests(tests: TestCase[]): Promise<TestResult[]> {
	const results: TestResult[] = []

	for (const test of tests) {
		const cleanups: Array<() => void> = []
		const ctx: TestContext = { cleanup: fn => cleanups.push(fn) }
		const start = performance.now()
		let error: string | undefined

		try {
			await test.fn(ctx)
		} catch (e) {
			error = e instanceof Error ? (e.stack ?? e.message) : String(e)
		}

		for (const fn of cleanups.reverse()) {
			try {
				fn()
			} catch (e) {
				console.error(`${LOG_PREFIX} cleanup error`, ...LOG_STYLE, e)
			}
		}

		// Let any debounced trailing update from the test settle before the next one.
		await delay(300)

		results.push({
			group: test.group,
			name: test.name,
			passed: !error,
			error,
			durationMs: Math.round(performance.now() - start),
		})
	}

	// Safety net: make sure every patch is back in a consistent applied state.
	try {
		BlockbenchPatchManager.updatePatches()
	} catch (e) {
		console.error(`${LOG_PREFIX} final updatePatches() failed`, ...LOG_STYLE, e)
	}

	return results
}

function report(results: TestResult[]) {
	const passed = results.filter(r => r.passed)
	const failed = results.filter(r => !r.passed)

	console.groupCollapsed(
		`${LOG_PREFIX} %c${passed.length}/${results.length} passed`,
		...LOG_STYLE,
		failed.length ? 'color: #ff5555; font-weight: bold;' : 'color: #55ff55; font-weight: bold;'
	)
	let lastGroup = ''
	for (const result of results) {
		if (result.group !== lastGroup) {
			console.log(`%c${result.group}`, 'color: #aaaaaa; font-weight: bold;')
			lastGroup = result.group
		}
		if (result.passed) {
			console.log(
				`  %c✓%c ${result.name} %c(${result.durationMs}ms)`,
				'color: #55ff55;',
				'color: inherit;',
				'color: #888;'
			)
		} else {
			console.log(`  %c✗%c ${result.name}`, 'color: #ff5555;', 'color: inherit;')
			console.log(`      %c${result.error}`, 'color: #ff9999;')
		}
	}
	console.groupEnd()

	const summary =
		`${passed.length}/${results.length} tests passed` +
		(failed.length
			? `\n\nFailures:\n` +
				failed.map(f => `  • ${f.group} › ${f.name}\n    ${firstLine(f.error)}`).join('\n')
			: `\n\nAll patch-manager checks passed.`)

	Blockbench.showQuickMessage(
		failed.length ? `Patch Manager: ${failed.length} test(s) failed` : 'Patch Manager: all tests passed',
		3000
	)
	Blockbench.showMessageBox({
		title: 'Patch Manager Test Results',
		message: summary,
	})
}

function firstLine(text: string | undefined): string {
	return (text ?? 'unknown error').split('\n')[0]
}

async function waitForRegistration() {
	for (let i = 0; i < 100; i++) {
		if (Plugins.registered[PLUGIN_ID]) return
		await delay(20)
	}
	throw new Error(
		`Plugin '${PLUGIN_ID}' is not in Plugins.registered — cannot register test patches.`
	)
}

/**
 * In-flight run, if any. The suite mutates the single live
 * `BlockbenchPatchManager` (timers, patch state), so two overlapping runs would
 * corrupt each other's assertions. This makes {@link run} single-flight: the
 * plugin's on-load run and an external `runPatchManagerTests()` call share one
 * execution instead of racing. The first caller's options win.
 */
let activeRun: Promise<TestResult[]> | null = null

function run(options: { report?: boolean } = {}): Promise<TestResult[]> {
	activeRun ??= doRun(options).finally(() => {
		activeRun = null
	})
	return activeRun
}

async function doRun({ report: shouldReport = true }: { report?: boolean }): Promise<TestResult[]> {
	await waitForRegistration()
	console.log(`${LOG_PREFIX} running ${TESTS.length} tests...`, ...LOG_STYLE)
	const results = await runTests(TESTS)
	if (shouldReport) report(results)
	return results
}

BBPlugin.register(PLUGIN_ID, {
	title: 'Blockbench Patch Manager — Test Suite',
	author: 'SnaveSutit',
	description: 'Runs a self-check suite against the live BlockbenchPatchManager and reports the results.',
	icon: 'science',
	version: '1.0.0',
	variant: 'both',
	tags: ['Developer'],
	onload() {
		// Re-run on demand from the dev console.
		const scope = globalThis as Record<string, unknown>
		scope.runPatchManagerTests = run
		void run().catch(error => {
			console.error(`${LOG_PREFIX} test run crashed`, ...LOG_STYLE, error)
			Blockbench.showMessageBox({
				title: 'Patch Manager Test Results',
				message: `The test run crashed before completing:\n\n${String(error)}`,
			})
		})
	},
	onunload() {
		delete (globalThis as Record<string, unknown>).runPatchManagerTests
		// Drop any test patches that a failed run may have left behind.
		for (const id of [...BlockbenchPatchManager.registered.keys()]) {
			if (!id.startsWith(`${PLUGIN_ID}:`)) continue
			const patch = BlockbenchPatchManager.registered.get(id)!
			try {
				if (patch.isApplied()) patch.revert()
				BlockbenchPatchManager.removePatch(id)
			} catch (error) {
				console.error(`${LOG_PREFIX} failed to clean up '${id}'`, ...LOG_STYLE, error)
			}
		}
	},
})
