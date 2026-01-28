import { getUnusedSymbols } from "../db/queries.ts";
import type { UnusedResult } from "../types.ts";
import { DEFAULTS, parseIntFlag, setupCommand } from "./shared.ts";

export async function lost(
	flags: Record<string, string | boolean> = {},
): Promise<UnusedResult> {
	const ctx = await setupCommand();
	const limit = parseIntFlag({
		flags,
		key: "limit",
		defaultValue: DEFAULTS.UNUSED_LIMIT,
	});

	const unusedSymbols = getUnusedSymbols(ctx.db, limit);

	const result: UnusedResult = {
		unused: unusedSymbols,
	};

	return result;
}
