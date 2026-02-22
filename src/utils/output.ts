import { encode } from "@toon-format/toon";

export function output({
	data,
	isJson = false,
}: {
	data: unknown;
	isJson?: boolean;
}): void {
	if (isJson) {
		console.log(JSON.stringify(data));
		return;
	}
	console.log(encode(data));
}

export function outputJson(data: unknown): void {
	console.log(JSON.stringify(data));
}
