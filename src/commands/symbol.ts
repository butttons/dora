import { searchSymbols } from "../db/queries.ts";
import type { SymbolSearchResult } from "../types.ts";
import {
	DEFAULTS,
	parseIntFlag,
	parseOptionalStringFlag,
	setupCommand,
} from "./shared.ts";

export async function symbol(
	query: string,
	flags: Record<string, string | boolean> = {},
): Promise<SymbolSearchResult> {
	const ctx = await setupCommand();
	const limit = parseIntFlag({
		flags,
		key: "limit",
		defaultValue: DEFAULTS.SYMBOL_LIMIT,
	});
	const kind = parseOptionalStringFlag({ flags, key: "kind" });

	const results = searchSymbols(ctx.db, query, { kind, limit });

	const enhancedResults = results.map((result) => {
		const symbolIdQuery = `
      SELECT s.id
      FROM symbols s
      JOIN files f ON f.id = s.file_id
      WHERE s.name = ? AND f.path = ? AND s.start_line = ?
      LIMIT 1
    `;

		const symbolRow = ctx.db
			.query(symbolIdQuery)
			.get(result.name, result.path, result.lines?.[0] ?? 0) as {
			id: number;
		} | null;

		if (!symbolRow) {
			return result;
		}

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

	return {
		query,
		results: enhancedResults,
	};
}
