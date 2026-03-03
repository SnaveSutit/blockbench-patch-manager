export class PatchApplyError extends Error {
	constructor(id: string, err: Error) {
		super(`'${id}' failed to apply: ${err.message}` + (err.stack ? '\n' + err.stack : ''))
	}
}

export class PatchRevertError extends Error {
	constructor(id: string, err: Error) {
		super(`'${id}' failed to revert: ${err.message}` + (err.stack ? '\n' + err.stack : ''))
	}
}
