// ctx imports command

import { getFileImports } from "../db/queries.ts";
import type { ImportsResult } from "../types.ts";
import { outputJson, resolveAndValidatePath, setupCommand } from "./shared.ts";

export async function imports(
	path: string,
	_flags: Record<string, string | boolean> = {},
): Promise<void> {
	const ctx = await setupCommand();
	const relativePath = resolveAndValidatePath(ctx, path);

	const importsList = getFileImports(ctx.db, relativePath);

	const result: ImportsResult = {
		path: relativePath,
		imports: importsList,
	};

	outputJson(result);
}
