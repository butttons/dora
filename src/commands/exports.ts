import {
	fileExists,
	getFileExports,
	getPackageExports,
} from "../db/queries.ts";
import type { ExportsResult } from "../types.ts";
import { CtxError } from "../utils/errors.ts";
import { outputJson, resolvePath, setupCommand } from "./shared.ts";

export async function exports(
	target: string,
	_flags: Record<string, string | boolean> = {},
): Promise<void> {
	const ctx = await setupCommand();

	// Try as file path first
	const relativePath = resolvePath({ ctx: { ctx, inputPath: target } });

	if (fileExists({ db: ctx.db, relativePath })) {
		const exportedSymbols = getFileExports(ctx.db, relativePath);
		if (exportedSymbols.length > 0) {
			const result: ExportsResult = {
				target: relativePath,
				exports: exportedSymbols,
			};
			outputJson(result);
			return;
		}
	}

	// Try as package name
	const packageExports = getPackageExports(ctx.db, target);
	if (packageExports.length > 0) {
		const result: ExportsResult = {
			target,
			exports: packageExports,
		};
		outputJson(result);
		return;
	}

	throw new CtxError(`No exports found for '${target}'`);
}
