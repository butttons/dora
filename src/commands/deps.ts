import { getDependencies } from "../db/queries.ts";
import type { DepsResult } from "../types.ts";
import {
	DEFAULTS,
	parseIntFlag,
	resolveAndValidatePath,
	setupCommand,
} from "./shared.ts";

export async function deps(
	path: string,
	flags: Record<string, string | boolean> = {},
): Promise<DepsResult> {
	const ctx = await setupCommand();
	const depth = parseIntFlag({
		flags,
		key: "depth",
		defaultValue: DEFAULTS.DEPTH,
	});
	const relativePath = resolveAndValidatePath({ ctx, inputPath: path });

	const dependencies = getDependencies(ctx.db, relativePath, depth);

	const result: DepsResult = {
		path: relativePath,
		depth,
		dependencies,
	};

	return result;
}
