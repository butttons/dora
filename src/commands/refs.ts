import { getSymbolReferences } from "../db/queries.ts";
import type { RefsResult, RefsSearchResult } from "../types.ts";
import {
	DEFAULTS,
	parseIntFlag,
	parseOptionalStringFlag,
	setupCommand,
} from "./shared.ts";

export async function refs(
	query: string,
	flags: Record<string, string | boolean> = {},
): Promise<RefsSearchResult> {
	const ctx = await setupCommand();
	const kind = parseOptionalStringFlag({ flags, key: "kind" });
	const limit = parseIntFlag({
		flags,
		key: "limit",
		defaultValue: DEFAULTS.REFS_LIMIT,
	});

	const results = getSymbolReferences(ctx.db, query, { kind, limit });

	const output: RefsResult[] = results.map((result) => ({
		symbol: result.name,
		kind: result.kind,
		definition: result.definition,
		references: result.references,
		total_references: result.references.length,
	}));

	const finalResult: RefsSearchResult = { query, results: output };

	return finalResult;
}
