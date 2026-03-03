export class ModInstallError extends Error {
	constructor(id: string, err: Error) {
		super(`'${id}' failed to install: ${err.message}` + (err.stack ? '\n' + err.stack : ''))
	}
}

export class ModUninstallError extends Error {
	constructor(id: string, err: Error) {
		super(`'${id}' failed to uninstall: ${err.message}` + (err.stack ? '\n' + err.stack : ''))
	}
}
