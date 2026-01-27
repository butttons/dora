import { getFileImports } from "../db/queries.ts";
import type { ImportsResult } from "../types.ts";
import { resolveAndValidatePath, setupCommand } from "./shared.ts";

export async function imports(
	path: string,
	_flags: Record<string, string | boolean> = {},
): Promise<ImportsResult> {
	const ctx = await setupCommand();
	const relativePath = resolveAndValidatePath({ ctx, inputPath: path });

	const importsList = getFileImports(ctx.db, relativePath);

	return {
		path: relativePath,
		imports: importsList,
	};
}
