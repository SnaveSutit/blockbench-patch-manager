import { defineConfig } from 'blockbench-plugin-test'

export default defineConfig({
	// 5.1.6 is already installed locally via envbench, so the suite runs offline.
	blockbenchVersion: '5.1.6',
	// Dedicated, isolated envbench environment (created on first run).
	environment: 'blockbench-patch-manager-tests',
	// The test plugin bundles its own copy of dist/, so this is all that loads.
	// Its file name must match Plugin.register('bb_patch_manager_test').
	plugins: ['./test/bb_patch_manager_test.js'],
	headless: true,
})
