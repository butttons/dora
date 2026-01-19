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

	// Enhance results with related documentation
	const enhancedResults = results.map((result) => {
		// Get symbol ID
		const symbolIdQuery = `
      SELECT s.id
      FROM symbols s
      JOIN files f ON f.id = s.file_id
      WHERE s.name = ? AND f.path = ? AND s.start_line = ?
      LIMIT 1
    `;

		const symbolRow = ctx.db
			.query(symbolIdQuery)
			.get(result.name, result.path, result.lines?.[0]) as
			| { id: number }
			| null;

		if (!symbolRow) {
			return result;
		}

		// Get documents referencing this symbol
		const docsQuery = `
      SELECT d.path
      FROM documents d
      JOIN document_symbol_refs dsr ON dsr.document_id = d.id
      WHERE dsr.symbol_id = ?
      ORDER BY d.path
    `;

		const docs = ctx.db.query(docsQuery).all(symbolRow.id) as Array<{
			path: string;
		}>;

		if (docs.length > 0) {
			return {
				...result,
				documented_in: docs.map((d) => d.path),
			};
		}

		return result;
	});

	const output: SymbolSearchResult = {
		query,
		results: enhancedResults,
	};

	outputJson(output);
}
