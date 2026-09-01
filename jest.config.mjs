/** @type {import('jest').Config} */
export default {
	preset: '@snavesutit/jestbench',
	rootDir: '.',
	testMatch: ['<rootDir>/test/e2e/**/*.test.ts'],
	transform: {
		'^.+\\.ts$': ['@swc/jest', { jsc: { target: 'es2022' } }],
	},
}
