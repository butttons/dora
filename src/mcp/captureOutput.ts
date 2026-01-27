export async function captureJsonOutput(
	fn: () => Promise<void> | void,
): Promise<any> {
	const originalLog = console.log;
	let captured = "";

	console.log = (message: string) => {
		captured += message;
	};

	try {
		await fn();
		return JSON.parse(captured);
	} finally {
		console.log = originalLog;
	}
}
