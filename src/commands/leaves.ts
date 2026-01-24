import { getLeafNodes } from "../db/queries.ts";
import type { LeavesResult } from "../types.ts";
import { DEFAULTS, outputJson, parseIntFlag, setupCommand } from "./shared.ts";

export async function leaves(
	flags: Record<string, string | boolean> = {},
): Promise<void> {
	const ctx = await setupCommand();
	const maxDependents = parseIntFlag({
		flags,
		key: "max-dependents",
		defaultValue: DEFAULTS.LEAF_MAX_DEPENDENTS,
	});

	const leafNodes = getLeafNodes(ctx.db, maxDependents);

	const result: LeavesResult = {
		max_dependents: maxDependents,
		leaves: leafNodes,
	};

	outputJson(result);
}
