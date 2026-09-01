# Patch Manager test suite

The assertions live in a Blockbench plugin (`src/**`) that runs a self-check
suite against the live `BlockbenchPatchManager`. It can be run two ways:

- **Automated (CI):** [`@snavesutit/jestbench`](https://github.com/SnaveSutit/jestbench)
  loads the plugin into a headless, isolated Blockbench and turns each result
  into a Jest assertion — see [`e2e/patch-manager.test.ts`](./e2e/patch-manager.test.ts).
- **Manual:** load `test/bb_patch_manager_test.js` into a running Blockbench and
  read the results dialog.

The plugin bundles its own copy of the built library (`dist/`) and exercises the
real `registerPatch` / `registerProjectPatch` / `registerPropertyOverridePatch` /
`overrideAccessors` entry points, covering:

- apply / revert lifecycle and enable/disable
- priority and dependency ordering, reverse-order teardown
- duplicate-id replacement, `removePatch` guard, unknown-dependency rejection
- `PatchApplyError` / revert-before-apply error wrapping
- the debounced `queuePatchUpdate()` — leading-edge run, coalesced trailing run,
  final-state correctness, and the re-entrancy guard
- `registerPropertyOverridePatch` getter swap + `enumerable` preservation
- `overrideAccessors` chaining and unwinding
- `registerProjectPatch` reacting to `pre_select_project` / `unselect_project`

## Build

```sh
bun run build          # compile src/ -> dist/  (the plugin bundles dist/)
bun run build:test     # bundle test/src/ -> test/bb_patch_manager_test.js
bun run typecheck:test # type-check the test sources (src/ + e2e/)
```

## Run automated

```sh
bun run test           # pretest builds both bundles, then runs Jest
```

Requirements: `xvfb-run` on `PATH` for headless Linux.
[`envbench`](https://github.com/SnaveSutit/envbench) is a dependency of
`@snavesutit/jestbench`, so it needs no global install. Config lives in
`blockbench.config.mjs` (Blockbench version, envbench environment) and
`jest.config.mjs` (the `@snavesutit/jestbench` preset). The suite pins
Blockbench `5.1.6`; the first run downloads it (~120 MB) unless the
`~/.envbench` portables cache is already warm.

The e2e test runs the in-app suite once via `blockbench.evaluate` and asserts per
group. On failure the group's Jest error lists every failed check with its stack.

## Run manually

1. In Blockbench: **File ▸ Plugins ▸ Load Plugin from File** ▸ pick
   `test/bb_patch_manager_test.js`.
2. The suite runs on load. Results print to the dev console (grouped) and a
   summary dialog opens.
3. Re-run any time from the dev console with `runPatchManagerTests()`.

Best run in a fresh Blockbench instance — the suite calls
`BlockbenchPatchManager.updatePatches()`, which reverts and re-applies every
registered patch, including those owned by other plugins.

## Notes

- `run()` is single-flight: the on-load run and a `runPatchManagerTests()` call
  share one execution rather than racing over the single live manager.
- `test/src/**` and `test/e2e/**` are excluded from the library's
  `tsconfig.json` and ESLint config; they use `test/tsconfig.json`.
- `registerPropertyOverridePatch` currently returns `void`, so the tests look up
  its handle via `BlockbenchPatchManager.registered.get(id)`.
