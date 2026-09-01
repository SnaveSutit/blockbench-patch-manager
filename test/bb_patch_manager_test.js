// GENERATED — do not edit. Source: test/src/*.ts  ·  Rebuild: bun run build && bun run build:test
"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // dist/log.js
  var require_log = __commonJS({
    "dist/log.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.prettyWarn = exports.prettyError = exports.prettyGroup = exports.prettyGroupCollapsed = exports.prettyLog = void 0;
      var PREFIX = "%c[%cBlockbench Patch Manager%c]%c ";
      var PREFIX_STYLES = ["color: #aaaaaa", "color: #00aced;", "color: #aaaaaa", "color: white"];
      function prettyLogFactory(logFunction) {
        return (strings, includePrefix = true) => {
          const primary = (includePrefix ? PREFIX : "") + "%c" + Object.keys(strings).join("%c");
          const formats = [...includePrefix ? PREFIX_STYLES : [], ...Object.values(strings)];
          logFunction(primary, ...formats);
        };
      }
      exports.prettyLog = prettyLogFactory(console.log);
      exports.prettyGroupCollapsed = prettyLogFactory(console.groupCollapsed);
      exports.prettyGroup = prettyLogFactory(console.group);
      exports.prettyError = prettyLogFactory(console.error);
      exports.prettyWarn = prettyLogFactory(console.warn);
    }
  });

  // node_modules/simple-subpub/dist/index.js
  var require_dist = __commonJS({
    "node_modules/simple-subpub/dist/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.ERROR_MESSAGE = void 0;
      exports.subscribable = subscribable;
      var ERROR_MESSAGE;
      (function(ERROR_MESSAGE2) {
        ERROR_MESSAGE2["RecursivePublish"] = "Subscribable callbacks cannot publish to the same subscribable, ignoring nested publish.";
        ERROR_MESSAGE2["InvalidCount"] = "Count must be a positive number.";
        ERROR_MESSAGE2["NonIntegerCount"] = "Count must be an integer.";
      })(ERROR_MESSAGE || (exports.ERROR_MESSAGE = ERROR_MESSAGE = {}));
      function subscribable() {
        const subscribers = /* @__PURE__ */ new Set();
        let publishing = false;
        const subscribe = (callback, once = false) => {
          const subscriber = { callback, once };
          subscribers.add(subscriber);
          return () => subscribers.delete(subscriber);
        };
        const publish = (value) => {
          if (publishing) {
            throw new Error(ERROR_MESSAGE.RecursivePublish);
          }
          publishing = true;
          try {
            for (const subscriber of subscribers) {
              subscriber.callback(value);
              if (subscriber.once)
                subscribers.delete(subscriber);
            }
          } finally {
            publishing = false;
          }
        };
        const unsubscribe = (callback, count2 = Infinity) => {
          if (count2 <= 0) {
            throw new Error(ERROR_MESSAGE.InvalidCount);
          } else if (Number.isFinite(count2) && !Number.isInteger(count2)) {
            throw new Error(ERROR_MESSAGE.NonIntegerCount);
          }
          let removed = 0;
          for (const subscriber of subscribers) {
            if (subscriber.callback === callback) {
              subscribers.delete(subscriber);
              if (++removed >= count2)
                return true;
            }
          }
          return removed > 0;
        };
        const has = (callback) => {
          for (const subscriber of subscribers) {
            if (subscriber.callback === callback)
              return true;
          }
          return false;
        };
        const count = (callback) => {
          let result = 0;
          for (const subscriber of subscribers) {
            if (subscriber.callback === callback)
              result++;
          }
          return result;
        };
        return {
          subscribe,
          subscribeOnce: (callback) => subscribe(callback, true),
          publish,
          unsubscribe,
          unsubscribeAll: () => subscribers.clear(),
          has,
          count,
          get subscriberCount() {
            return subscribers.size;
          }
        };
      }
      exports.default = subscribable;
    }
  });

  // dist/errors.js
  var require_errors = __commonJS({
    "dist/errors.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.PatchRevertError = exports.PatchApplyError = void 0;
      var PatchApplyError = class extends Error {
        constructor(id, err) {
          super(`'${id}' failed to apply: ${err.message}` + (err.stack ? "\n" + err.stack : ""));
        }
      };
      exports.PatchApplyError = PatchApplyError;
      var PatchRevertError = class extends Error {
        constructor(id, err) {
          super(`'${id}' failed to revert: ${err.message}` + (err.stack ? "\n" + err.stack : ""));
        }
      };
      exports.PatchRevertError = PatchRevertError;
    }
  });

  // dist/patchers.js
  var require_patchers = __commonJS({
    "dist/patchers.js"(exports) {
      "use strict";
      var __importDefault = exports && exports.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.registerPatch = registerPatch2;
      exports.registerProjectPatch = registerProjectPatch2;
      exports.registerPluginPatch = registerPluginPatch;
      exports.registerDeletableHandlerPatch = registerDeletableHandlerPatch;
      exports.registerPropertyOverridePatch = registerPropertyOverridePatch2;
      require_manager();
      var simple_subpub_1 = __importDefault(require_dist());
      var errors_1 = require_errors();
      var log_1 = require_log();
      function registerPatch2(options) {
        if (!BlockbenchPatchManager.validatePatchId(options.id)) {
          throw new Error(`Failed to register patch with invalid ID '${options.id}'. See previous warnings for more details.`);
        }
        let applyContext;
        let applied = false;
        const handle = {
          id: options.id,
          dependencies: options.dependencies,
          priority: options.priority ?? 0,
          enabled: true,
          isApplied() {
            return applied;
          },
          apply() {
            if (!this.enabled)
              return;
            (0, log_1.prettyLog)({ "Applying ": "color: #55ff55;", [options.id]: "color: #ffff55;" });
            try {
              if (applied)
                throw new Error(`Attempted to apply '${options.id}' while it was already applied.`);
              applyContext = options.apply();
              applied = true;
            } catch (err) {
              debugger;
              throw new errors_1.PatchApplyError(options.id, err);
            }
          },
          revert() {
            if (!this.enabled && !applied)
              return;
            (0, log_1.prettyLog)({ "Reverting ": "color: #ff5555;", [options.id]: "color: #ffff55;" });
            try {
              if (!applied)
                throw new Error(`Attempted to revert '${options.id}' before it was applied.`);
              options.revert(applyContext);
              applied = false;
            } catch (err) {
              debugger;
              throw new errors_1.PatchRevertError(options.id, err);
            }
          }
        };
        BlockbenchPatchManager.addPatch(handle);
        return handle;
      }
      function registerProjectPatch2(options) {
        let revertContext = null;
        let parentPatchHandle;
        options.alwaysRevertOnProjectChange ??= false;
        let applied = false;
        const onPreSelectProject = (project) => {
          if (applied)
            return;
          if (!Condition(options.condition, { project }))
            return;
          (0, log_1.prettyLog)({ "Applying project patch ": "color: #55ff55;", [options.id]: "color: #ffff55;" });
          revertContext = options.apply();
          applied = true;
        };
        const onUnselectProject = () => {
          if (!applied)
            return;
          (0, log_1.prettyLog)({
            "Reverting project patch ": "color: #ff5555;",
            [options.id]: "color: #ffff55;"
          });
          options.revert(revertContext);
          revertContext = null;
          applied = false;
        };
        parentPatchHandle = registerPatch2({
          ...options,
          apply: () => {
            Blockbench.on("blockbench-patch-manager:pre_select_project", onPreSelectProject);
            Blockbench.on("unselect_project", onUnselectProject);
          },
          revert: () => {
            Blockbench.removeListener("blockbench-patch-manager:pre_select_project", onPreSelectProject);
            Blockbench.removeListener("unselect_project", onUnselectProject);
          }
        });
        return parentPatchHandle;
      }
      function registerPluginPatch(options) {
        let revertContext;
        const onLoadedPlugin = ({ plugin }) => {
          if (!Condition(options.condition, plugin))
            return;
          (0, log_1.prettyLog)({ "Applying plugin patch ": "color: #55ff55;", [options.id]: "color: #ffff55;" });
          revertContext = options.apply();
        };
        const onUnloadedPlugin = () => {
          if (revertContext !== void 0) {
            (0, log_1.prettyLog)({
              "Reverting plugin patch ": "color: #ff5555;",
              [options.id]: "color: #ffff55;"
            });
            options.revert(revertContext);
            revertContext = void 0;
          }
        };
        return registerPatch2({
          ...options,
          apply: () => {
            Blockbench.on("loaded_plugin", onLoadedPlugin);
            Blockbench.on("unloaded_plugin", onUnloadedPlugin);
          },
          revert: () => {
            Blockbench.removeListener("loaded_plugin", onLoadedPlugin);
            Blockbench.removeListener("unloaded_plugin", onUnloadedPlugin);
          }
        });
      }
      function registerDeletableHandlerPatch(options) {
        let instance = null;
        const created = (0, simple_subpub_1.default)();
        const deleted = (0, simple_subpub_1.default)();
        const handle = {
          get: () => instance,
          onCreated: created.subscribe,
          onDeleted: deleted.subscribe
        };
        registerPatch2({
          ...options,
          apply: () => {
            instance = options.create();
            created.publish(instance);
            return instance;
          },
          revert: (lastInstance) => {
            lastInstance.delete();
            instance = null;
            deleted.publish(lastInstance);
          }
        });
        return handle;
      }
      function registerPropertyOverridePatch2(options) {
        if (!options.get && !options.set) {
          throw new Error(`At least one of 'get' or 'set' must be provided in a PropertyOverridePatch.`);
        }
        registerPatch2({
          ...options,
          apply: () => {
            if (options.target == void 0) {
              throw new Error(`Cannot override property on undefined object.`);
            }
            let currentValue;
            try {
              currentValue = options.target[options.key];
            } catch {
              throw new Error(`Failed to get initial value of property '${String(options.key)}' for PropertyOverridePatch ${String(options.id)}.`);
            }
            const originalDescriptor = Object.getOwnPropertyDescriptor(options.target, options.key) ?? {
              value: currentValue,
              writable: true,
              configurable: true
            };
            if (originalDescriptor.configurable === false) {
              throw new Error(`Cannot override property '${String(options.key)}' on object because it is not configurable.`);
            }
            const descriptor = {
              configurable: true,
              enumerable: originalDescriptor.enumerable
            };
            if (options.get) {
              let getCondition;
              if (options.condition && options.getCondition) {
                getCondition = (context) => {
                  return Condition(options.condition, context) && Condition(options.getCondition, context);
                };
              } else {
                getCondition = options.getCondition ?? options.condition;
              }
              if (getCondition) {
                descriptor.get = function() {
                  if (Condition(getCondition, { target: this, value: currentValue })) {
                    return options.get.call(this, currentValue);
                  }
                  return currentValue;
                };
              } else {
                descriptor.get = function() {
                  return options.get.call(this, currentValue);
                };
              }
            }
            if (options.set) {
              let setCondition;
              if (options.condition && options.setCondition) {
                setCondition = (context) => {
                  return Condition(options.condition, context) && Condition(options.setCondition, context);
                };
              } else {
                setCondition = options.setCondition ?? options.condition;
              }
              if (setCondition) {
                descriptor.set = function(value) {
                  if (Condition(setCondition, { target: this, value })) {
                    currentValue = options.set.call(this, value);
                  } else {
                    currentValue = value;
                  }
                };
              } else {
                descriptor.set = function(value) {
                  currentValue = options.set.call(this, value);
                };
              }
            }
            Object.defineProperty(options.target, options.key, descriptor);
            return { originalDescriptor };
          },
          revert: ({ originalDescriptor }) => {
            Object.defineProperty(options.target, options.key, originalDescriptor);
          }
        });
      }
    }
  });

  // package.json
  var require_package = __commonJS({
    "package.json"(exports, module) {
      module.exports = {
        name: "blockbench-patch-manager",
        version: "1.1.0",
        author: {
          name: "SnaveSutit",
          email: "snavesutit@gmail.com",
          url: "https://snavesutit.github.io"
        },
        repository: {
          type: "git",
          url: "git+https://github.com/SnaveSutit/blockbench-patch-manager.git"
        },
        files: [
          "dist"
        ],
        main: "./dist/index.js",
        types: "./dist/index.d.ts",
        scripts: {
          build: "tsc",
          dev: "tsc --watch",
          "build:test": 'esbuild test/src/index.ts --bundle --outfile=test/bb_patch_manager_test.js --format=iife --target=es2022 --platform=browser --legal-comments=none --banner:js="// GENERATED \u2014 do not edit. Source: test/src/*.ts  \xB7  Rebuild: bun run build && bun run build:test"',
          "typecheck:test": "tsc -p test/tsconfig.json",
          pretest: "bun run build && bun run build:test",
          test: "jest",
          prepublishOnly: "bun run build"
        },
        exports: {
          ".": {
            types: "./dist/index.d.ts",
            default: "./dist/index.js"
          }
        },
        peerDependencies: {
          typescript: "^5"
        },
        dependencies: {
          "blockbench-types": "^5.1.0-beta.1",
          "simple-subpub": "^1.2.0",
          svelte: "^5.46.3",
          "svelte-observable-store": "^1.0.1",
          "svelte-preprocess": "^6.0.3",
          "svelte-preprocess-esbuild": "^3.0.1"
        },
        devDependencies: {
          "@jest/globals": "^30.5.1",
          "@snavesutit/jestbench": "^0.1.0",
          "@swc/jest": "^0.2.39",
          "@types/node": "^25.0.8",
          esbuild: "^0.27.2",
          "eslint-plugin-check-file": "^3.3.1",
          "eslint-plugin-svelte": "^3.14.0",
          jest: "^30.5.1",
          jiti: "^2.6.1",
          "svelte-eslint-parser": "^1.4.1",
          typescript: "^5.9.3",
          "typescript-eslint": "^8.53.0"
        },
        trustedDependencies: [
          "@swc/core"
        ]
      };
    }
  });

  // dist/manager.js
  var require_manager = __commonJS({
    "dist/manager.js"(exports) {
      "use strict";
      var __importDefault = exports && exports.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      var log_1 = require_log();
      var patchers_1 = require_patchers();
      var package_json_1 = __importDefault(require_package());
      var PATCH_UPDATE_COOLDOWN = 250;
      var PatchManager = class _PatchManager {
        static latestVersion = package_json_1.default.version;
        version = package_json_1.default.version;
        registered = /* @__PURE__ */ new Map();
        installOrder = [];
        updateCooldown;
        pendingUpdate = false;
        updatingPatches = false;
        static upgrade(oldManager) {
          oldManager.delete();
          const manager = new _PatchManager();
          manager.installOrder = [...oldManager.installOrder];
          for (const [patchId, patch] of oldManager.registered) {
            manager.registered.set(patchId, patch);
          }
          manager.runPatchUpdate();
          return manager;
        }
        constructor() {
          Blockbench.addListener("loaded_plugin", this.onLoadedPlugin);
          Blockbench.addListener("unloaded_plugin", this.onUnloadedPlugin);
          window.BlockbenchPatchManager = this;
          (0, patchers_1.registerPropertyOverridePatch)({
            id: `blockbench-patch-manager:event-hook/pre-select-project`,
            priority: -Infinity,
            target: ModelProject.prototype,
            key: "loadEditorState",
            get(original) {
              return function() {
                Blockbench.dispatchEvent("blockbench-patch-manager:pre_select_project", this);
                return original.apply(this);
              };
            }
          });
        }
        delete() {
          Blockbench.removeListener("loaded_plugin", this.onLoadedPlugin);
          Blockbench.removeListener("unloaded_plugin", this.onUnloadedPlugin);
          const eventPatch = this.registered.get(`blockbench-patch-manager:event-hook/pre-select-project`);
          if (this.updateCooldown !== void 0) {
            clearTimeout(this.updateCooldown);
            this.updateCooldown = void 0;
          }
          this.pendingUpdate = false;
          if (eventPatch) {
            try {
              void eventPatch.revert();
            } catch (error) {
              (0, log_1.prettyError)({
                [`Failed to revert event hook patch: ${error}`]: "color: #ff5555;"
              });
            }
            this.registered.delete(eventPatch.id);
          } else {
            (0, log_1.prettyWarn)({
              [`Failed to find event hook patch when deleting PatchManager. This may cause issues if the plugin is reloaded without restarting Blockbench.`]: "color: #ff5555;"
            });
          }
        }
        onLoadedPlugin = ({ plugin }) => {
          (0, log_1.prettyLog)({ [`Plugin '${plugin.name}' loaded, enabling its patches...`]: "" });
          this.setPluginPatchesEnabled(plugin, true);
          this.queuePatchUpdate();
        };
        onUnloadedPlugin = ({ plugin }) => {
          (0, log_1.prettyLog)({ [`Plugin '${plugin.name}' unloaded, disabling its patches...`]: "" });
          this.setPluginPatchesEnabled(plugin, false);
          this.queuePatchUpdate();
        };
        /**
         * Requests a patch update.
         *
         * The first request runs immediately so plugin loads/unloads feel
         * responsive. Any further request that arrives within
         * {@link PATCH_UPDATE_COOLDOWN}ms of the previous one is collapsed into a
         * single trailing update that runs once the cooldown elapses without another
         * request — so a slow sequence of plugin loads waits for the final plugin
         * before re-running.
         */
        queuePatchUpdate() {
          const runImmediately = this.updateCooldown === void 0;
          this.startUpdateCooldown();
          if (runImmediately) {
            this.runPatchUpdate();
          } else {
            this.pendingUpdate = true;
          }
        }
        startUpdateCooldown() {
          if (this.updateCooldown !== void 0) {
            clearTimeout(this.updateCooldown);
          }
          this.updateCooldown = setTimeout(() => {
            this.updateCooldown = void 0;
            if (!this.pendingUpdate)
              return;
            this.pendingUpdate = false;
            try {
              this.runPatchUpdate();
            } finally {
              this.startUpdateCooldown();
            }
          }, PATCH_UPDATE_COOLDOWN);
        }
        runPatchUpdate() {
          if (this.updatingPatches) {
            this.pendingUpdate = true;
            return;
          }
          this.updatingPatches = true;
          try {
            this.updatePatches();
          } finally {
            this.updatingPatches = false;
          }
        }
        addPatch(patch) {
          if (this.registered.has(patch.id)) {
            (0, log_1.prettyWarn)({
              [`A Patch with the ID '${patch.id}' is already registered! The old patch will be overwritten.`]: "color: #ff5555;"
            });
            const oldPatch = this.registered.get(patch.id);
            if (oldPatch?.isApplied()) {
              try {
                oldPatch.revert();
              } catch (error) {
                (0, log_1.prettyError)({
                  [`Failed to revert old patch '${patch.id}': ${error}`]: "color: #ff5555;"
                });
              }
            }
            this.removePatch(patch.id);
          }
          this.registered.set(patch.id, patch);
          this.installOrder.push(patch.id);
          this.updatePatchApplicationOrder();
        }
        removePatch(patchId) {
          const patch = this.registered.get(patchId);
          if (!patch) {
            (0, log_1.prettyWarn)({
              [`Attempted to remove unknown patch '${patchId}'!`]: "color: #ff5555;"
            });
            return;
          }
          if (patch.isApplied()) {
            throw new Error(`Attempted to remove patch '${patchId}' while it is still applied! This indicates a patch has been improperly managed by a plugin developer.`);
          }
          this.registered.delete(patchId);
          const index = this.installOrder.indexOf(patchId);
          if (index !== -1) {
            this.installOrder.splice(index, 1);
          }
        }
        checkPatchDependencies(patch) {
          if (patch.dependencies === void 0)
            return true;
          for (const dependencyId of patch.dependencies) {
            const dependency = this.registered.get(dependencyId);
            if (!dependency) {
              (0, log_1.prettyWarn)({
                [`Patch '${patch.id}' depends on unknown patch '${dependencyId}'.`]: ""
              });
              return false;
            }
            if (!dependency.isApplied()) {
              throw new Error(`Patch '${patch.id}' depends on patch '${dependencyId}', but it is not applied. This is a bug!`);
            }
          }
          return true;
        }
        updatePatches() {
          (0, log_1.prettyGroupCollapsed)({ "Updating Patches...": "color: #aaaaaa;" });
          try {
            (0, log_1.prettyLog)({ "Reverting patches...": "color: #ff5555; font-weight: bold;" });
            for (const patchId of this.installOrder.slice().reverse()) {
              const patch = this.registered.get(patchId);
              if (patch.isApplied()) {
                patch.revert();
              }
            }
            (0, log_1.prettyLog)({ "Applying enabled patches...": "color: #55ff55; font-weight: bold;" });
            for (const patchId of this.installOrder) {
              const patch = this.registered.get(patchId);
              if (!patch.isApplied() && patch.enabled) {
                if (!this.checkPatchDependencies(patch)) {
                  (0, log_1.prettyWarn)({
                    [`Skipping patch '${patch.id}' due to missing dependencies.`]: ""
                  });
                  continue;
                }
                patch.apply();
              }
            }
          } catch (e) {
            console.groupEnd();
            throw e;
          }
          console.groupEnd();
        }
        getPatchOwner(modId) {
          const [namespace] = modId.split(":");
          return Plugins.registered[namespace];
        }
        validatePatchId(patchId) {
          const [namespace] = patchId.split(":");
          if (namespace === "blockbench-patch-manager")
            return true;
          const plugin = Plugins.registered[namespace];
          if (!plugin) {
            (0, log_1.prettyError)({
              [`Patch '${patchId}' depends on an unknown plugin '${namespace}' which is not installed.`]: ""
            });
            return false;
          }
          return true;
        }
        setPluginPatchesEnabled(plugin, enabled) {
          for (const patch of this.registered.values()) {
            const patchOwner = this.getPatchOwner(patch.id);
            if (patchOwner?.id === plugin.id) {
              patch.enabled = enabled;
            }
          }
        }
        updatePatchApplicationOrder() {
          this.installOrder.sort((a, b) => {
            const patchA = this.registered.get(a);
            const patchB = this.registered.get(b);
            return patchB.priority - patchA.priority;
          });
          for (const patchId of this.installOrder) {
            const patch = this.registered.get(patchId);
            if (patch.dependencies === void 0)
              continue;
            for (const dependencyId of patch.dependencies) {
              const dependencyIndex = this.installOrder.indexOf(dependencyId);
              if (dependencyIndex === -1) {
                throw new Error(`Patch '${patchId}' depends on unknown patch '${dependencyId}'`);
              }
              const patchIndex = this.installOrder.indexOf(patchId);
              if (dependencyIndex > patchIndex) {
                this.installOrder.splice(dependencyIndex, 1);
                this.installOrder.splice(patchIndex, 0, dependencyId);
              }
            }
          }
        }
      };
      if (window.BlockbenchPatchManager == null) {
        new PatchManager();
      } else if (
        // @ts-expect-error - Blockbench VersionUtil library isn't typed yet.
        VersionUtil.compare(window.BlockbenchPatchManager.version ?? "0.0.0", "<", PatchManager.latestVersion)
      ) {
        console.warn(`A newer version of Blockbench Patch Mangager (${PatchManager.latestVersion}) is installed alongside an old version ${window.BlockbenchPatchManager.version}. Attempting to upgrade the old version...`);
        PatchManager.upgrade(window.BlockbenchPatchManager);
      }
    }
  });

  // dist/accessors.js
  var require_accessors = __commonJS({
    "dist/accessors.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.overrideAccessors = overrideAccessors2;
      var simple_subpub_1 = require_dist();
      var ACCESSORS_SYMBOL = /* @__PURE__ */ Symbol("accessors");
      function overrideAccessors2(options) {
        const { target, key, get, set, restoreOriginalValue = false } = options;
        if (get == void 0 && set == void 0) {
          throw new TypeError("At least one of get or set callbacks must be provided");
        }
        if (target == void 0)
          throw new TypeError("Target is undefined");
        const originalValue = target[key];
        const originalDescriptor = Object.getOwnPropertyDescriptor(target, key) ?? {
          value: originalValue,
          writable: true,
          configurable: true
        };
        if (originalDescriptor.configurable === false) {
          throw new Error(`Cannot redefine property: ${String(key)} as it is not configurable`);
        }
        const createEntry = () => {
          target[ACCESSORS_SYMBOL] ??= /* @__PURE__ */ new Map();
          const entry = { onGet: (0, simple_subpub_1.subscribable)(), onSet: (0, simple_subpub_1.subscribable)() };
          target[ACCESSORS_SYMBOL].set(key, entry);
          return entry;
        };
        const { onGet, onSet } = target[ACCESSORS_SYMBOL]?.get(key) ?? createEntry();
        let currentValue = target[key];
        let unsubGet;
        let getReturnValue = currentValue;
        if (get) {
          unsubGet = onGet.subscribe((unmodified) => {
            getReturnValue = get.call(target, getReturnValue, unmodified);
          });
        }
        let unsubSet;
        let setReturnValue = currentValue;
        if (set) {
          unsubSet = onSet.subscribe((unmodified) => {
            setReturnValue = set.call(target, setReturnValue, unmodified);
          });
        }
        const overrideDescriptor = {
          configurable: true,
          enumerable: originalDescriptor.enumerable,
          get() {
            getReturnValue = currentValue;
            onGet.publish(currentValue);
            return getReturnValue;
          },
          set(value) {
            setReturnValue = value;
            onSet.publish(value);
            currentValue = setReturnValue;
          }
        };
        try {
          Object.defineProperty(target, key, overrideDescriptor);
        } catch (e) {
          throw new Error(`Failed to override property: ${String(key)}. ${e instanceof Error ? e.message : String(e)}`);
        }
        return () => {
          unsubGet?.();
          unsubSet?.();
          try {
            Object.defineProperty(target, key, originalDescriptor);
          } catch (e) {
            throw new Error(`Failed to restore original property: ${String(key)}. ${e instanceof Error ? e.message : String(e)}`);
          }
          if (restoreOriginalValue) {
            target[key] = originalValue;
          }
          const accessorsMap = target[ACCESSORS_SYMBOL];
          if (accessorsMap) {
            const entry = accessorsMap.get(key);
            if (entry?.onGet.subscriberCount === 0 && entry.onSet.subscriberCount === 0) {
              accessorsMap.delete(key);
              if (accessorsMap.size === 0)
                delete target[ACCESSORS_SYMBOL];
            }
          }
        };
      }
    }
  });

  // dist/index.js
  var require_dist2 = __commonJS({
    "dist/index.js"(exports) {
      "use strict";
      var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() {
            return m[k];
          } };
        }
        Object.defineProperty(o, k2, desc);
      }) : (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        o[k2] = m[k];
      }));
      var __exportStar = exports && exports.__exportStar || function(m, exports2) {
        for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      require_manager();
      __exportStar(require_patchers(), exports);
      __exportStar(require_accessors(), exports);
    }
  });

  // test/src/harness.ts
  var PLUGIN_ID = "bb_patch_manager_test";
  var AssertionError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "AssertionError";
    }
  };
  function assert(condition, message) {
    if (!condition) throw new AssertionError(message);
  }
  function assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new AssertionError(
        `${message}
      expected: ${format(expected)}
      actual:   ${format(actual)}`
      );
    }
  }
  function assertDeepEqual(actual, expected, message) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
      throw new AssertionError(`${message}
      expected: ${e}
      actual:   ${a}`);
    }
  }
  function assertThrows(fn, message, matcher) {
    try {
      fn();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (matcher && !matcher.test(err.message)) {
        throw new AssertionError(
          `${message}
      thrown message ${JSON.stringify(
            err.message
          )} did not match ${String(matcher)}`
        );
      }
      return err;
    }
    throw new AssertionError(`${message}
      expected the function to throw, but it did not`);
  }
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function format(value) {
    if (typeof value === "string") return JSON.stringify(value);
    if (typeof value === "object" && value !== null) return JSON.stringify(value);
    return String(value);
  }

  // test/src/tests.ts
  var import_dist = __toESM(require_dist2());
  var EVENT_HOOK_ID = "blockbench-patch-manager:event-hook/pre-select-project";
  var COOLDOWN_WAIT = 400;
  function createPatch(ctx, options) {
    const state = { applyCount: 0, revertCount: 0 };
    const handle = (0, import_dist.registerPatch)({
      id: `${PLUGIN_ID}:${options.name}`,
      priority: options.priority,
      dependencies: options.dependencies,
      apply: () => {
        state.applyCount++;
        options.timeline?.push(`apply:${options.name}`);
        options.onApply?.();
      },
      revert: () => {
        state.revertCount++;
        options.timeline?.push(`revert:${options.name}`);
      }
    });
    trackHandle(ctx, handle);
    return { handle, state };
  }
  function trackHandle(ctx, handle) {
    ctx.cleanup(() => {
      try {
        if (handle.isApplied()) handle.revert();
      } catch (error) {
        console.error("[cleanup] revert failed", error);
      }
      try {
        if (BlockbenchPatchManager.registered.get(handle.id) === handle) {
          BlockbenchPatchManager.removePatch(handle.id);
        }
      } catch (error) {
        console.error("[cleanup] removePatch failed", error);
      }
    });
  }
  var TESTS = [
    // ─── Manager basics ──────────────────────────────────────────────────────
    {
      group: "Manager",
      name: "global singleton exposes the expected API",
      fn: () => {
        assert(
          typeof BlockbenchPatchManager === "object" && BlockbenchPatchManager != null,
          "BlockbenchPatchManager global exists"
        );
        const api = BlockbenchPatchManager;
        for (const method of ["addPatch", "removePatch", "updatePatches", "queuePatchUpdate"]) {
          assert(
            typeof api[method] === "function",
            `BlockbenchPatchManager.${method}() is a function`
          );
        }
        assert(BlockbenchPatchManager.registered instanceof Map, "registered is a Map");
        assert(Array.isArray(BlockbenchPatchManager.installOrder), "installOrder is an array");
      }
    },
    {
      group: "Manager",
      name: "built-in pre_select_project event hook is registered and applies",
      fn: () => {
        assert(
          BlockbenchPatchManager.registered.has(EVENT_HOOK_ID),
          "event hook patch is registered"
        );
        BlockbenchPatchManager.updatePatches();
        assert(
          BlockbenchPatchManager.registered.get(EVENT_HOOK_ID).isApplied(),
          "event hook patch is applied after updatePatches()"
        );
      }
    },
    // ─── Apply / revert lifecycle ────────────────────────────────────────────
    {
      group: "Lifecycle",
      name: "a patch applies on updatePatches() and reverts when disabled",
      fn: (ctx) => {
        const p = createPatch(ctx, { name: "lifecycle-basic" });
        BlockbenchPatchManager.updatePatches();
        assert(p.handle.isApplied(), "patch is applied");
        assertEqual(p.state.applyCount, 1, "apply() ran once");
        p.handle.enabled = false;
        BlockbenchPatchManager.updatePatches();
        assert(!p.handle.isApplied(), "patch is reverted after being disabled");
        assertEqual(p.state.revertCount, 1, "revert() ran once");
      }
    },
    {
      group: "Lifecycle",
      name: "a disabled patch is never applied",
      fn: (ctx) => {
        const p = createPatch(ctx, { name: "lifecycle-disabled" });
        p.handle.enabled = false;
        BlockbenchPatchManager.updatePatches();
        assert(!p.handle.isApplied(), "disabled patch stays unapplied");
        assertEqual(p.state.applyCount, 0, "apply() never ran");
      }
    },
    // ─── Ordering ────────────────────────────────────────────────────────────
    {
      group: "Ordering",
      name: "higher priority patches apply first",
      fn: (ctx) => {
        const timeline = [];
        createPatch(ctx, { name: "prio-low", priority: -10, timeline });
        createPatch(ctx, { name: "prio-high", priority: 10, timeline });
        createPatch(ctx, { name: "prio-mid", priority: 0, timeline });
        BlockbenchPatchManager.updatePatches();
        assertDeepEqual(
          timeline.filter((e) => e.startsWith("apply:")),
          ["apply:prio-high", "apply:prio-mid", "apply:prio-low"],
          "apply order follows descending priority"
        );
      }
    },
    {
      group: "Ordering",
      name: "a dependency applies before its dependent despite lower priority",
      fn: (ctx) => {
        const timeline = [];
        createPatch(ctx, { name: "dep-base", priority: -100, timeline });
        createPatch(ctx, {
          name: "dep-main",
          priority: 100,
          dependencies: [`${PLUGIN_ID}:dep-base`],
          timeline
        });
        BlockbenchPatchManager.updatePatches();
        const applies = timeline.filter((e) => e.startsWith("apply:"));
        assert(
          applies.indexOf("apply:dep-base") < applies.indexOf("apply:dep-main"),
          `dependency applied before dependent (order: ${applies.join(", ")})`
        );
      }
    },
    {
      group: "Ordering",
      name: "patches revert in the reverse of their apply order",
      fn: (ctx) => {
        const timeline = [];
        createPatch(ctx, { name: "rev-a", priority: 30, timeline });
        createPatch(ctx, { name: "rev-b", priority: 20, timeline });
        createPatch(ctx, { name: "rev-c", priority: 10, timeline });
        BlockbenchPatchManager.updatePatches();
        timeline.length = 0;
        BlockbenchPatchManager.updatePatches();
        assertDeepEqual(
          timeline.filter((e) => e.startsWith("revert:")),
          ["revert:rev-c", "revert:rev-b", "revert:rev-a"],
          "revert order is the reverse of apply order"
        );
        assertDeepEqual(
          timeline.filter((e) => e.startsWith("apply:")),
          ["apply:rev-a", "apply:rev-b", "apply:rev-c"],
          "re-apply order still follows priority"
        );
      }
    },
    // ─── Registration ────────────────────────────────────────────────────────
    {
      group: "Registration",
      name: "registering a duplicate id replaces the previous handle",
      fn: (ctx) => {
        const id = `${PLUGIN_ID}:dupe`;
        const first = (0, import_dist.registerPatch)({ id, apply: () => {
        }, revert: () => {
        } });
        ctx.cleanup(() => {
          try {
            if (BlockbenchPatchManager.registered.get(id) === first) {
              BlockbenchPatchManager.removePatch(id);
            }
          } catch (error) {
            console.error(error);
          }
        });
        BlockbenchPatchManager.updatePatches();
        assert(first.isApplied(), "first handle is applied");
        const second = (0, import_dist.registerPatch)({ id, apply: () => {
        }, revert: () => {
        } });
        trackHandle(ctx, second);
        assert(!first.isApplied(), "first handle was reverted when replaced");
        assertEqual(
          BlockbenchPatchManager.registered.get(id),
          second,
          "registry now points at the second handle"
        );
        assertEqual(
          BlockbenchPatchManager.installOrder.filter((p) => p === id).length,
          1,
          "install order has exactly one entry for the id"
        );
      }
    },
    {
      group: "Registration",
      name: "registering a patch with an unknown dependency throws",
      fn: (ctx) => {
        const id = `${PLUGIN_ID}:orphan-dep`;
        ctx.cleanup(() => {
          try {
            BlockbenchPatchManager.removePatch(id);
          } catch {
          }
        });
        assertThrows(
          () => (0, import_dist.registerPatch)({
            id,
            dependencies: [`${PLUGIN_ID}:ghost`],
            apply: () => {
            },
            revert: () => {
            }
          }),
          "registerPatch rejects an unknown dependency",
          /depends on unknown patch/
        );
      }
    },
    {
      group: "Registration",
      name: "removePatch throws while the patch is still applied",
      fn: (ctx) => {
        const p = createPatch(ctx, { name: "remove-guard" });
        BlockbenchPatchManager.updatePatches();
        assert(p.handle.isApplied(), "patch is applied");
        assertThrows(
          () => BlockbenchPatchManager.removePatch(p.handle.id),
          "removePatch refuses an applied patch",
          /still applied/
        );
      }
    },
    // ─── Error wrapping ──────────────────────────────────────────────────────
    {
      group: "Errors",
      name: "errors thrown in apply() are wrapped",
      fn: (ctx) => {
        const id = `${PLUGIN_ID}:throw-apply`;
        const handle = (0, import_dist.registerPatch)({
          id,
          apply: () => {
            throw new Error("boom-apply");
          },
          revert: () => {
          }
        });
        ctx.cleanup(() => {
          try {
            BlockbenchPatchManager.removePatch(id);
          } catch (error) {
            console.error(error);
          }
        });
        const err = assertThrows(
          () => handle.apply(),
          "apply() surfaces an error",
          /failed to apply/
        );
        assert(/boom-apply/.test(err.message), "wrapped error keeps the original message");
        assert(!handle.isApplied(), "patch is not marked applied after a failed apply");
      }
    },
    {
      group: "Errors",
      name: "reverting before applying throws",
      fn: (ctx) => {
        const id = `${PLUGIN_ID}:revert-early`;
        const handle = (0, import_dist.registerPatch)({ id, apply: () => {
        }, revert: () => {
        } });
        trackHandle(ctx, handle);
        assertThrows(
          () => handle.revert(),
          "revert() before apply() is rejected",
          /before it was applied/
        );
      }
    },
    // ─── Debounced updates ───────────────────────────────────────────────────
    {
      group: "Debounce",
      name: "queuePatchUpdate() applies immediately on the leading edge",
      fn: async (ctx) => {
        const p = createPatch(ctx, { name: "debounce-leading" });
        assert(!p.handle.isApplied(), "patch not applied before queuing");
        BlockbenchPatchManager.queuePatchUpdate();
        assert(
          p.handle.isApplied(),
          "patch applied synchronously after the first queuePatchUpdate()"
        );
        await delay(COOLDOWN_WAIT);
      }
    },
    {
      group: "Debounce",
      name: "a burst of queuePatchUpdate() calls collapses to one leading + one trailing run",
      fn: async (ctx) => {
        const original = BlockbenchPatchManager.updatePatches.bind(BlockbenchPatchManager);
        let calls = 0;
        const manager = BlockbenchPatchManager;
        manager.updatePatches = () => {
          calls++;
          original();
        };
        ctx.cleanup(() => {
          delete manager.updatePatches;
        });
        createPatch(ctx, { name: "debounce-burst" });
        BlockbenchPatchManager.queuePatchUpdate();
        BlockbenchPatchManager.queuePatchUpdate();
        BlockbenchPatchManager.queuePatchUpdate();
        BlockbenchPatchManager.queuePatchUpdate();
        assertEqual(calls, 1, "exactly one synchronous (leading) update");
        await delay(COOLDOWN_WAIT);
        assertEqual(calls, 2, "one trailing update after the cooldown elapses");
        await delay(COOLDOWN_WAIT);
        assertEqual(calls, 2, "no further updates once things go quiet");
      }
    },
    {
      group: "Debounce",
      name: "the trailing update reflects the final enable/disable state",
      fn: async (ctx) => {
        const a = createPatch(ctx, { name: "debounce-final-a" });
        BlockbenchPatchManager.queuePatchUpdate();
        assert(a.handle.isApplied(), "A applied on the leading edge");
        const b = createPatch(ctx, { name: "debounce-final-b" });
        a.handle.enabled = false;
        BlockbenchPatchManager.queuePatchUpdate();
        await delay(COOLDOWN_WAIT);
        assert(!a.handle.isApplied(), "A reverted by the trailing update after being disabled");
        assert(b.handle.isApplied(), "B applied by the trailing update");
      }
    },
    {
      group: "Debounce",
      name: "an apply() that re-enters queuePatchUpdate() does not recurse forever",
      fn: async (ctx) => {
        let applyCount = 0;
        const id = `${PLUGIN_ID}:reentrant`;
        const handle = (0, import_dist.registerPatch)({
          id,
          apply: () => {
            applyCount++;
            if (applyCount < 3) BlockbenchPatchManager.queuePatchUpdate();
          },
          revert: () => {
          }
        });
        ctx.cleanup(() => {
          try {
            if (handle.isApplied()) handle.revert();
          } catch (error) {
            console.error(error);
          }
          try {
            BlockbenchPatchManager.removePatch(id);
          } catch (error) {
            console.error(error);
          }
        });
        BlockbenchPatchManager.queuePatchUpdate();
        assert(handle.isApplied(), "patch applied on the leading edge");
        await delay(COOLDOWN_WAIT * 5);
        assert(handle.isApplied(), "patch still applied once the cooldown settles");
        assert(applyCount < 10, `apply() did not run away (ran ${applyCount}\xD7)`);
      }
    },
    // ─── Property override patches ───────────────────────────────────────────
    {
      group: "Property override",
      name: "registerPropertyOverridePatch swaps the getter and restores it on revert",
      fn: (ctx) => {
        const target = { value: 1 };
        const id = `${PLUGIN_ID}:prop-get`;
        (0, import_dist.registerPropertyOverridePatch)({ id, target, key: "value", get: () => 42 });
        const handle = BlockbenchPatchManager.registered.get(id);
        trackHandle(ctx, handle);
        BlockbenchPatchManager.updatePatches();
        assertEqual(target.value, 42, "getter override is active");
        handle.enabled = false;
        BlockbenchPatchManager.updatePatches();
        assertEqual(target.value, 1, "original value is restored after revert");
        assert(
          !("get" in Object.getOwnPropertyDescriptor(target, "value")),
          "original data descriptor is restored"
        );
      }
    },
    {
      group: "Property override",
      name: "a non-enumerable property stays non-enumerable through apply and revert",
      fn: (ctx) => {
        const target = {};
        Object.defineProperty(target, "hidden", {
          value: 5,
          enumerable: false,
          writable: true,
          configurable: true
        });
        const id = `${PLUGIN_ID}:prop-enumerable`;
        (0, import_dist.registerPropertyOverridePatch)({ id, target, key: "hidden", get: (value) => value });
        const handle = BlockbenchPatchManager.registered.get(id);
        trackHandle(ctx, handle);
        BlockbenchPatchManager.updatePatches();
        assertEqual(
          Object.getOwnPropertyDescriptor(target, "hidden").enumerable,
          false,
          "override keeps enumerable: false"
        );
        handle.enabled = false;
        BlockbenchPatchManager.updatePatches();
        const restored = Object.getOwnPropertyDescriptor(target, "hidden");
        assertEqual(restored.enumerable, false, "restored descriptor keeps enumerable: false");
        assertEqual(restored.value, 5, "restored descriptor keeps the original value");
      }
    },
    // ─── Low-level accessor overrides ────────────────────────────────────────
    {
      group: "Accessors",
      name: "overrideAccessors transforms reads and fully restores on cleanup",
      fn: () => {
        const target = { n: 5 };
        const cleanup = (0, import_dist.overrideAccessors)({ target, key: "n", get: (value) => value * 2 });
        try {
          assertEqual(target.n, 10, "getter override doubles the value");
        } finally {
          cleanup();
        }
        assertEqual(target.n, 5, "value is restored after cleanup");
        const descriptor = Object.getOwnPropertyDescriptor(target, "n");
        assert(
          "value" in descriptor && !("get" in descriptor),
          "the original data descriptor is restored"
        );
      }
    },
    {
      group: "Accessors",
      name: "stacked overrideAccessors calls chain and unwind cleanly",
      fn: () => {
        const target = { n: 1 };
        const cleanupA = (0, import_dist.overrideAccessors)({ target, key: "n", get: (value) => value + 10 });
        let cleanupB = (0, import_dist.overrideAccessors)({
          target,
          key: "n",
          get: (value) => value + 100
        });
        try {
          assert(target.n > 100, `both overrides participate in the read (got ${target.n})`);
          cleanupB();
          cleanupB = void 0;
          assert(
            target.n >= 11 && target.n < 100,
            `only the first override remains after removing the second (got ${target.n})`
          );
        } finally {
          cleanupB?.();
          cleanupA();
        }
        assertEqual(target.n, 1, "the original value is restored after all cleanups");
      }
    },
    // ─── Project patches ─────────────────────────────────────────────────────
    {
      group: "Project patches",
      name: "registerProjectPatch reacts to pre_select_project / unselect_project",
      fn: (ctx) => {
        let applied = 0;
        let reverted = 0;
        const id = `${PLUGIN_ID}:project`;
        const handle = (0, import_dist.registerProjectPatch)({
          id,
          condition: () => true,
          apply: () => {
            applied++;
          },
          revert: () => {
            reverted++;
          }
        });
        trackHandle(ctx, handle);
        BlockbenchPatchManager.updatePatches();
        assert(handle.isApplied(), "the project patch parent is applied (listeners attached)");
        Blockbench.dispatchEvent(
          "blockbench-patch-manager:pre_select_project",
          {}
        );
        assertEqual(applied, 1, "apply ran when a project was selected");
        Blockbench.dispatchEvent("unselect_project", {});
        assertEqual(reverted, 1, "revert ran when the project was deselected");
      }
    }
  ];

  // test/src/index.ts
  var LOG_PREFIX = "%c[Patch Manager Tests]%c";
  var LOG_STYLE = ["color: #00aced; font-weight: bold;", "color: inherit;"];
  async function runTests(tests) {
    const results = [];
    for (const test of tests) {
      const cleanups = [];
      const ctx = { cleanup: (fn) => cleanups.push(fn) };
      const start = performance.now();
      let error;
      try {
        await test.fn(ctx);
      } catch (e) {
        error = e instanceof Error ? e.stack ?? e.message : String(e);
      }
      for (const fn of cleanups.reverse()) {
        try {
          fn();
        } catch (e) {
          console.error(`${LOG_PREFIX} cleanup error`, ...LOG_STYLE, e);
        }
      }
      await delay(300);
      results.push({
        group: test.group,
        name: test.name,
        passed: !error,
        error,
        durationMs: Math.round(performance.now() - start)
      });
    }
    try {
      BlockbenchPatchManager.updatePatches();
    } catch (e) {
      console.error(`${LOG_PREFIX} final updatePatches() failed`, ...LOG_STYLE, e);
    }
    return results;
  }
  function report(results) {
    const passed = results.filter((r) => r.passed);
    const failed = results.filter((r) => !r.passed);
    console.groupCollapsed(
      `${LOG_PREFIX} %c${passed.length}/${results.length} passed`,
      ...LOG_STYLE,
      failed.length ? "color: #ff5555; font-weight: bold;" : "color: #55ff55; font-weight: bold;"
    );
    let lastGroup = "";
    for (const result of results) {
      if (result.group !== lastGroup) {
        console.log(`%c${result.group}`, "color: #aaaaaa; font-weight: bold;");
        lastGroup = result.group;
      }
      if (result.passed) {
        console.log(
          `  %c\u2713%c ${result.name} %c(${result.durationMs}ms)`,
          "color: #55ff55;",
          "color: inherit;",
          "color: #888;"
        );
      } else {
        console.log(`  %c\u2717%c ${result.name}`, "color: #ff5555;", "color: inherit;");
        console.log(`      %c${result.error}`, "color: #ff9999;");
      }
    }
    console.groupEnd();
    const summary = `${passed.length}/${results.length} tests passed` + (failed.length ? `

Failures:
` + failed.map((f) => `  \u2022 ${f.group} \u203A ${f.name}
    ${firstLine(f.error)}`).join("\n") : `

All patch-manager checks passed.`);
    Blockbench.showQuickMessage(
      failed.length ? `Patch Manager: ${failed.length} test(s) failed` : "Patch Manager: all tests passed",
      3e3
    );
    Blockbench.showMessageBox({
      title: "Patch Manager Test Results",
      message: summary
    });
  }
  function firstLine(text) {
    return (text ?? "unknown error").split("\n")[0];
  }
  async function waitForRegistration() {
    for (let i = 0; i < 100; i++) {
      if (Plugins.registered[PLUGIN_ID]) return;
      await delay(20);
    }
    throw new Error(
      `Plugin '${PLUGIN_ID}' is not in Plugins.registered \u2014 cannot register test patches.`
    );
  }
  var activeRun = null;
  function run(options = {}) {
    activeRun ??= doRun(options).finally(() => {
      activeRun = null;
    });
    return activeRun;
  }
  async function doRun({ report: shouldReport = true }) {
    await waitForRegistration();
    console.log(`${LOG_PREFIX} running ${TESTS.length} tests...`, ...LOG_STYLE);
    const results = await runTests(TESTS);
    if (shouldReport) report(results);
    return results;
  }
  BBPlugin.register(PLUGIN_ID, {
    title: "Blockbench Patch Manager \u2014 Test Suite",
    author: "SnaveSutit",
    description: "Runs a self-check suite against the live BlockbenchPatchManager and reports the results.",
    icon: "science",
    version: "1.0.0",
    variant: "both",
    tags: ["Developer"],
    onload() {
      const scope = globalThis;
      scope.runPatchManagerTests = run;
      void run().catch((error) => {
        console.error(`${LOG_PREFIX} test run crashed`, ...LOG_STYLE, error);
        Blockbench.showMessageBox({
          title: "Patch Manager Test Results",
          message: `The test run crashed before completing:

${String(error)}`
        });
      });
    },
    onunload() {
      delete globalThis.runPatchManagerTests;
      for (const id of [...BlockbenchPatchManager.registered.keys()]) {
        if (!id.startsWith(`${PLUGIN_ID}:`)) continue;
        const patch = BlockbenchPatchManager.registered.get(id);
        try {
          if (patch.isApplied()) patch.revert();
          BlockbenchPatchManager.removePatch(id);
        } catch (error) {
          console.error(`${LOG_PREFIX} failed to clean up '${id}'`, ...LOG_STYLE, error);
        }
      }
    }
  });
})();
