// ctx symbol command

import { searchSymbols } from "../db/queries.ts";
import type { SymbolSearchResult } from "../types.ts";
import { DEFAULTS, outputJson, parseIntFlag, setupCommand } from "./shared.ts";

export async function symbol(
	query: string,
	flags: Record<string, string | boolean> = {},
): Promise<void> {
	const ctx = await setupCommand();
	const limit = parseIntFlag(flags, "limit", DEFAULTS.SYMBOL_LIMIT);

	// Kind filter is optional - only parse if provided
	const kindString = flags.kind !== undefined ? String(flags.kind) : undefined;

	const results = searchSymbols(ctx.db, query, { kind: kindString, limit });

	const output: SymbolSearchResult = {
		query,
		results,
	};

	outputJson(output);
}
