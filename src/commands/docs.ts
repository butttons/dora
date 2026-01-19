// Documentation commands - find, search, and view documentation files
import { Command } from "commander";
import { outputJson, setupCommand } from "./shared.js";
import type { DocsResult, DocResult } from "../types.ts";
import {
  searchSymbols,
  getDocumentContent,
  getDocumentReferences,
  searchDocumentContent,
} from "../db/queries.js";

export function registerDocsCommand(program: Command): void {
  const docs = program
    .command("docs")
    .description("Find, search, and view documentation files");

  // dora docs find <symbol|file>
  docs
    .command("find")
    .argument("<query>", "Symbol name or file path to find in documentation")
    .description("Find documentation mentioning a symbol or file")
    .action(async (query: string) => {
      const ctx = await setupCommand();
      const db = ctx.db;

      // First, try to match as a file path
      const fileResult = db
        .query("SELECT id, path FROM files WHERE path = ?")
        .get(query) as { id: number; path: string } | null;

      if (fileResult) {
        // Found as a file - get documents referencing this file
        const docsQuery = `
          SELECT
            d.path,
            d.type,
            d.symbol_count as symbol_refs,
            d.file_count as file_refs
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
        }>;

        const result: DocsResult = {
          query,
          type: "file",
          documents: docs,
        };

        outputJson(result);
        return;
      }

      // Try to match as a symbol name
      const symbols = searchSymbols(db, query, { limit: 1 });

      if (symbols.length > 0) {
        const symbol = symbols[0];

        // Get the symbol ID
        const symbolIdQuery = `
          SELECT s.id
          FROM symbols s
          JOIN files f ON f.id = s.file_id
          WHERE s.name = ? AND f.path = ? AND s.start_line = ?
          LIMIT 1
        `;

        const symbolRow = db
          .query(symbolIdQuery)
          .get(symbol.name, symbol.path, symbol.lines?.[0]) as
          | { id: number }
          | null;

        if (symbolRow) {
          // Found the symbol - get documents referencing it
          const docsQuery = `
            SELECT
              d.path,
              d.type,
              d.symbol_count as symbol_refs,
              d.file_count as file_refs
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

      // No exact match - try fuzzy search for symbols
      const fuzzySymbols = searchSymbols(db, query, { limit: 5 });

      if (fuzzySymbols.length > 0) {
        // Get all symbol IDs
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
          // Get documents referencing any of these symbols
          const placeholders = symbolIds.map(() => "?").join(",");
          const docsQuery = `
            SELECT DISTINCT
              d.path,
              d.type,
              d.symbol_count as symbol_refs,
              d.file_count as file_refs
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

      // No matches found
      const result: DocsResult = {
        query,
        type: "symbol",
        documents: [],
      };

      outputJson(result);
    });

  // dora docs search <query>
  docs
    .command("search")
    .argument("<query>", "Text to search for in documentation")
    .option("-l, --limit <number>", "Maximum number of results", "20")
    .description("Search through documentation content")
    .action(async (query: string, options: { limit: string }) => {
      const ctx = await setupCommand();
      const db = ctx.db;
      const limit = parseInt(options.limit, 10);

      if (isNaN(limit) || limit <= 0) {
        throw new Error("Limit must be a positive number");
      }

      const results = searchDocumentContent(db, query, limit);

      const output = {
        query,
        limit,
        results: results.map((r) => ({
          path: r.path,
          type: r.type,
          symbol_refs: r.symbol_count,
          file_refs: r.file_count,
        })),
        total: results.length,
      };

      outputJson(output);
    });

  // dora docs show <path>
  docs
    .command("show")
    .argument("<path>", "Document path")
    .option("-c, --content", "Include full document content")
    .description("Show document metadata and references")
    .action(async (path: string, options: { content?: boolean }) => {
      const ctx = await setupCommand();
      const db = ctx.db;

      const doc = getDocumentContent(db, path);

      if (!doc) {
        throw new Error(`Document not found: ${path}`);
      }

      const refs = getDocumentReferences(db, path);

      const result: DocResult = {
        path: doc.path,
        type: doc.type,
        symbol_refs: refs.symbols,
        file_refs: refs.files,
        ...(options.content && { content: doc.content }),
      };

      outputJson(result);
    });
}
