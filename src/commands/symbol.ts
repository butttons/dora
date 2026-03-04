import { searchSymbols } from "../db/queries.ts";
import type { SymbolResult, SymbolSearchResult } from "../types.ts";
import { parseFunctions } from "../tree-sitter/parser.ts";
import {
	DEFAULTS,
	parseIntFlag,
	parseOptionalStringFlag,
	setupCommand,
} from "./shared.ts";

type FileGroupItem = {
	index: number;
	result: SymbolResult;
};

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

	const functionKinds = new Set(["function", "method"]);
	const fileGroups = new Map<string, FileGroupItem[]>();

	for (let i = 0; i < results.length; i++) {
		const result = results[i]!;
		if (functionKinds.has(result.kind)) {
			const existing = fileGroups.get(result.path);
			if (existing) {
				existing.push({ index: i, result });
			} else {
				fileGroups.set(result.path, [{ index: i, result }]);
			}
		}
	}

	const enhancedResults: SymbolResult[] = [...results];

	for (const [filePath, items] of fileGroups) {
		try {
			const { functions } = await parseFunctions({
				filePath: `${ctx.config.root}/${filePath}`,
				config: ctx.config,
			});

			const functionMap = new Map<
				string,
				{
					cyclomatic_complexity: number;
					parameters: Array<{ name: string; type: string | null }>;
					return_type: string | null;
				}
			>();

			for (const fn of functions) {
				const key = `${fn.name}:${fn.lines[0]}`;
				functionMap.set(key, {
					cyclomatic_complexity: fn.cyclomatic_complexity,
					parameters: fn.parameters,
					return_type: fn.return_type,
				});
			}

			for (const item of items) {
				const startLine = item.result.lines?.[0];
				if (startLine === undefined) continue;

				const key = `${item.result.name}:${startLine}`;
				const fnInfo = functionMap.get(key);

				if (fnInfo) {
					enhancedResults[item.index] = {
						...item.result,
						cyclomatic_complexity: fnInfo.cyclomatic_complexity,
						parameters: fnInfo.parameters,
						return_type: fnInfo.return_type,
					};
				}
			}
		} catch {
			// Gracefully skip if parsing fails or grammar unavailable
		}
	}

	const withDocs = enhancedResults.map((result) => {
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

	const finalResult: SymbolSearchResult = {
		query,
		results: withDocs,
	};

	return finalResult;
}
