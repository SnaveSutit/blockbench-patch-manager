import { registerPropertyOverridePatch } from '../patchers'

registerPropertyOverridePatch({
	id: `blockbench-patch-manager:event-hook/pre-select-project`,
	priority: -Infinity,

	target: ModelProject.prototype,
	key: 'loadEditorState',

	get(original) {
		return function (this: ModelProject) {
			console.log(
				`Dispatching 'blockbench-patch-manager:pre_select_project' event for project '${this.name}'`
			)
			Blockbench.dispatchEvent('blockbench-patch-manager:pre_select_project', this)
			return original.apply(this)
		}
	},
})
