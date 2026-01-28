import { getReverseDependencies } from "../db/queries.ts";
import type { RDepsResult } from "../types.ts";
import {
	DEFAULTS,
	parseIntFlag,
	resolveAndValidatePath,
	setupCommand,
} from "./shared.ts";

export async function rdeps(
	path: string,
	flags: Record<string, string | boolean> = {},
): Promise<RDepsResult> {
	const ctx = await setupCommand();
	const depth = parseIntFlag({
		flags,
		key: "depth",
		defaultValue: DEFAULTS.DEPTH,
	});
	const relativePath = resolveAndValidatePath({ ctx, inputPath: path });

	const dependents = getReverseDependencies(ctx.db, relativePath, depth);

	const result: RDepsResult = {
		path: relativePath,
		depth,
		dependents,
	};

	return result;
}
