import { searchSymbols } from "../../db/queries.ts";
import type { DocsResult } from "../../types.ts";
import { outputJson, setupCommand } from "../shared.ts";

export async function docsFind(query: string): Promise<void> {
	const ctx = await setupCommand();
	const db = ctx.db;

	const fileResult = db
		.query("SELECT id, path FROM files WHERE path = ?")
		.get(query) as { id: number; path: string } | null;

	if (fileResult) {
		const docsQuery = `
      SELECT
        d.path,
        d.type,
        d.symbol_count as symbol_refs,
        d.file_count as file_refs,
        d.document_count as document_refs
      FROM documents d
      JOIN document_file_refs dfr ON dfr.document_id = d.id
      WHERE dfr.file_id = ?
      ORDER BY d.path
    `;

		const docs = db.query(docsQuery).all(fileResult.id) as Array<{
			path: string;
			type: string;
			symbol_refs: number;
			file_refs: number;
			document_refs: number;
		}>;

		const result: DocsResult = {
			query,
			type: "file",
			documents: docs,
		};

		outputJson(result);
		return;
	}

	const symbols = searchSymbols(db, query, { limit: 1 });

	if (symbols.length > 0) {
		const symbol = symbols[0];

		const symbolIdQuery = `
      SELECT s.id
      FROM symbols s
      JOIN files f ON f.id = s.file_id
      WHERE s.name = ? AND f.path = ? AND s.start_line = ?
      LIMIT 1
    `;

		const symbolRow = db
			.query(symbolIdQuery)
			.get(symbol.name, symbol.path, symbol.lines?.[0]) as {
			id: number;
		} | null;

		if (symbolRow) {
			const docsQuery = `
        SELECT
          d.path,
          d.type,
          d.symbol_count as symbol_refs,
          d.file_count as file_refs,
          d.document_count as document_refs
        FROM documents d
        JOIN document_symbol_refs dsr ON dsr.document_id = d.id
        WHERE dsr.symbol_id = ?
        ORDER BY d.path
      `;

			const docs = db.query(docsQuery).all(symbolRow.id) as Array<{
				path: string;
				type: string;
				symbol_refs: number;
				file_refs: number;
				document_refs: number;
			}>;

			const result: DocsResult = {
				query,
				type: "symbol",
				documents: docs,
			};

			outputJson(result);
			return;
		}
	}

	const docResult = db
		.query("SELECT id, path FROM documents WHERE path = ?")
		.get(query) as { id: number; path: string } | null;

	if (docResult) {
		const docsQuery = `
      SELECT
        d.path,
        d.type,
        d.symbol_count as symbol_refs,
        d.file_count as file_refs,
        d.document_count as document_refs
      FROM documents d
      JOIN document_document_refs ddr ON ddr.document_id = d.id
      WHERE ddr.referenced_document_id = ?
      ORDER BY d.path
    `;

		const docs = db.query(docsQuery).all(docResult.id) as Array<{
			path: string;
			type: string;
			symbol_refs: number;
			file_refs: number;
			document_refs: number;
		}>;

		const result: DocsResult = {
			query,
			type: "document",
			documents: docs,
		};

		outputJson(result);
		return;
	}

	const fuzzySymbols = searchSymbols(db, query, { limit: 5 });

	if (fuzzySymbols.length > 0) {
		const symbolIds: number[] = [];

		for (const sym of fuzzySymbols) {
			const symbolIdQuery = `
        SELECT s.id
        FROM symbols s
        JOIN files f ON f.id = s.file_id
        WHERE s.name = ? AND f.path = ? AND s.start_line = ?
        LIMIT 1
      `;

			const symbolRow = db
				.query(symbolIdQuery)
				.get(sym.name, sym.path, sym.lines?.[0]) as { id: number } | null;

			if (symbolRow) {
				symbolIds.push(symbolRow.id);
			}
		}

		if (symbolIds.length > 0) {
			const placeholders = symbolIds.map(() => "?").join(",");
			const docsQuery = `
        SELECT DISTINCT
          d.path,
          d.type,
          d.symbol_count as symbol_refs,
          d.file_count as file_refs,
          d.document_count as document_refs
        FROM documents d
        JOIN document_symbol_refs dsr ON dsr.document_id = d.id
        WHERE dsr.symbol_id IN (${placeholders})
        ORDER BY d.path
      `;

			const docs = db.query(docsQuery).all(...symbolIds) as Array<{
				path: string;
				type: string;
				symbol_refs: number;
				file_refs: number;
				document_refs: number;
			}>;

			const result: DocsResult = {
				query,
				type: "symbol",
				documents: docs,
			};

			outputJson(result);
			return;
		}
	}

	const result: DocsResult = {
		query,
		type: "symbol",
		documents: [],
	};

	outputJson(result);
}
