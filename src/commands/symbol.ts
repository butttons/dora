// dora symbol command

import { searchSymbols } from "../db/queries.ts";
import type { SymbolSearchResult } from "../types.ts";
import {
	DEFAULTS,
	outputJson,
	parseIntFlag,
	parseOptionalStringFlag,
	setupCommand,
} from "./shared.ts";

export async function symbol(
	query: string,
	flags: Record<string, string | boolean> = {},
): Promise<void> {
	const ctx = await setupCommand();
	const limit = parseIntFlag(flags, "limit", DEFAULTS.SYMBOL_LIMIT);
	const kind = parseOptionalStringFlag(flags, "kind");

	const results = searchSymbols(ctx.db, query, { kind, limit });

  const output: SymbolSearchResult = {
    query,
    results,
  };

  outputJson(output);
}
