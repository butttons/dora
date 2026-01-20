import { getSymbolReferences } from "../db/queries.ts";
import type { RefsResult } from "../types.ts";
import {
	DEFAULTS,
	outputJson,
	parseIntFlag,
	parseOptionalStringFlag,
	setupCommand,
} from "./shared.ts";

export async function refs(
	query: string,
	flags: Record<string, string | boolean> = {},
): Promise<void> {
	const ctx = await setupCommand();
	const kind = parseOptionalStringFlag(flags, "kind");
	const limit = parseIntFlag(flags, "limit", DEFAULTS.REFS_LIMIT);

	const results = getSymbolReferences(ctx.db, query, { kind, limit });

	const output: RefsResult[] = results.map((result) => ({
		symbol: result.name,
		kind: result.kind,
		definition: result.definition,
		references: result.references,
		total_references: result.references.length,
	}));

	// If only one result, simplify output
	if (output.length === 1) {
		outputJson(output[0]);
	} else {
		outputJson({ query, results: output });
	}
}
