import { getLeafNodes } from "../db/queries.ts";
import type { LeavesResult } from "../types.ts";
import { DEFAULTS, parseIntFlag, setupCommand } from "./shared.ts";

export async function leaves(
	flags: Record<string, string | boolean> = {},
): Promise<LeavesResult> {
	const ctx = await setupCommand();
	const maxDependents = parseIntFlag({
		flags,
		key: "max-dependents",
		defaultValue: DEFAULTS.LEAF_MAX_DEPENDENTS,
	});

	const leafNodes = getLeafNodes(ctx.db, maxDependents);

	return {
		max_dependents: maxDependents,
		leaves: leafNodes,
	};
}
