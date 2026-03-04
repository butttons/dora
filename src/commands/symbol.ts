import { searchSymbols } from "../db/queries.ts";
import { parseFunctions } from "../tree-sitter/parser.ts";
import type { SymbolResult, SymbolSearchResult } from "../types.ts";
import { debugDb } from "../utils/logger.ts";
import {
	DEFAULTS,
	parseIntFlag,
	parseOptionalStringFlag,
	setupCommand,
} from "./shared.ts";
import { resolveAbsolute } from "../utils/paths.ts";

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

	for (let index = 0; index < results.length; index++) {
		const result = results[index]!;
		if (functionKinds.has(result.kind)) {
			const existing = fileGroups.get(result.path);
			if (existing) {
				existing.push({ index, result });
			} else {
				fileGroups.set(result.path, [{ index, result }]);
			}
		}
	}

	const enhancedResults: SymbolResult[] = [...results];

	for (const [filePath, items] of fileGroups) {
		try {
			const { functions } = await parseFunctions({
				filePath: resolveAbsolute({ root: ctx.config.root, relativePath: filePath }),
				config: ctx.config,
			});

			const functionsByName = new Map<string, typeof functions>();
			for (const fnItem of functions) {
				const existing = functionsByName.get(fnItem.name) ?? [];
				existing.push(fnItem);
				functionsByName.set(fnItem.name, existing);
			}

			for (const item of items) {
				const scipLine = item.result.lines?.[0];
				const cleanName = item.result.name.replace(/\(\)[^(]*$/, "");
				const candidates = functionsByName.get(cleanName);
				if (!candidates || scipLine === undefined) continue;

				const best = candidates.reduce((a, b) =>
					Math.abs(a.lines[0] - scipLine) <= Math.abs(b.lines[0] - scipLine)
						? a
						: b,
				);

				enhancedResults[item.index] = {
					...item.result,
					cyclomatic_complexity: best.cyclomatic_complexity,
					parameters: best.parameters,
					return_type: best.return_type,
				};
			}
		} catch (error) {
			debugDb(
				`Tree-sitter parse failed for ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
			);
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
				documented_in: docs.map((item) => item.path),
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
