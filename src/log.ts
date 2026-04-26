const PREFIX = '%c[%cBlockbench Patch Manager%c]%c '
const PREFIX_STYLES = ['color: #aaaaaa', 'color: #00aced;', 'color: #aaaaaa', 'color: white']

function prettyLogFactory(logFunction: (...args: any[]) => void) {
	return (strings: Record<string, string>, includePrefix = true) => {
		const primary = (includePrefix ? PREFIX : '') + '%c' + Object.keys(strings).join('%c')
		const formats = [...(includePrefix ? PREFIX_STYLES : []), ...Object.values(strings)]
		logFunction(primary, ...formats)
	}
}

export const prettyLog = prettyLogFactory(console.log)
export const prettyGroupCollapsed = prettyLogFactory(console.groupCollapsed)
export const prettyGroup = prettyLogFactory(console.group)
export const prettyError = prettyLogFactory(console.error)
export const prettyWarn = prettyLogFactory(console.warn)
