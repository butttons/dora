// Error handling utilities

export class CtxError extends Error {
	constructor(
		message: string,
		public code?: string,
		public data?: Record<string, unknown>,
	) {
		super(message);
		this.name = "CtxError";
	}
}

/**
 * Handle an error by outputting JSON to stderr and exiting with code 1
 */
function handleError(error: unknown): never {
	let errorOutput: Record<string, unknown>;

	if (error instanceof CtxError && error.data) {
		// Use structured error data if available
		errorOutput = { error: error.message, ...error.data };
	} else {
		// Fallback to simple error message
		const message = error instanceof Error ? error.message : String(error);
		errorOutput = { error: message };
	}

	console.error(JSON.stringify(errorOutput));
	process.exit(1);
}

/**
 * Wrap a command function with error handling
 */
export function wrapCommand<T extends (...args: any[]) => Promise<void>>(
	fn: T,
): T {
	return (async (...args: any[]) => {
		try {
			await fn(...args);
		} catch (error) {
			handleError(error);
		}
	}) as T;
}
