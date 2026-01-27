import {
	fileExists,
	getFileExports,
	getPackageExports,
} from "../db/queries.ts";
import type { ExportsResult } from "../types.ts";
import { CtxError } from "../utils/errors.ts";
import { resolvePath, setupCommand } from "./shared.ts";

export async function exports(
	target: string,
	_flags: Record<string, string | boolean> = {},
): Promise<ExportsResult> {
	const ctx = await setupCommand();

	// Try as file path first
	const relativePath = resolvePath({ ctx: { ctx, inputPath: target } });

	if (fileExists({ db: ctx.db, relativePath })) {
		const exportedSymbols = getFileExports(ctx.db, relativePath);
		if (exportedSymbols.length > 0) {
			return {
				target: relativePath,
				exports: exportedSymbols,
			};
		}
	}

	// Try as package name
	const packageExports = getPackageExports(ctx.db, target);
	if (packageExports.length > 0) {
		return {
			target,
			exports: packageExports,
		};
	}

	throw new CtxError(`No exports found for '${target}'`);
}
