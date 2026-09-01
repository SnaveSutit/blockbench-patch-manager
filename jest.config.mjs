/** @type {import('jest').Config} */
export default {
	preset: 'blockbench-plugin-test',
	rootDir: '.',
	testMatch: ['<rootDir>/test/e2e/**/*.test.ts'],
	transform: {
		'^.+\\.ts$': ['@swc/jest', { jsc: { target: 'es2022' } }],
	},
}
