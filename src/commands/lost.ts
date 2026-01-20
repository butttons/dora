import { getUnusedSymbols } from "../db/queries.ts";
import type { UnusedResult } from "../types.ts";
import { DEFAULTS, outputJson, parseIntFlag, setupCommand } from "./shared.ts";

export async function lost(
	flags: Record<string, string | boolean> = {},
): Promise<void> {
	const ctx = await setupCommand();
	const limit = parseIntFlag(flags, "limit", DEFAULTS.UNUSED_LIMIT);

	const unusedSymbols = getUnusedSymbols(ctx.db, limit);

	const result: UnusedResult = {
		unused: unusedSymbols,
	};

	outputJson(result);
}
