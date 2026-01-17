// JSON output utilities

/**
 * Output data as JSON to stdout
 */
export function outputJson(data: unknown): void {
	console.log(JSON.stringify(data, null, 2));
}
