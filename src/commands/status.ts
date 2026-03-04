import { getDb } from "../db/connection.ts";
import {
	getDocumentCount,
	getDocumentCountsByType,
	getFileCount,
	getSymbolCount,
} from "../db/queries.ts";
import { findGrammarPath } from "../tree-sitter/grammar.ts";
import type { StatusResult } from "../types.ts";
import { isIndexed, loadConfig } from "../utils/config.ts";

export async function status(): Promise<StatusResult> {
	const config = await loadConfig();

	// Check if indexed
	const indexed = await isIndexed(config);

	const result: StatusResult = {
		initialized: true, // If we got here, it's initialized
		indexed,
	};

	// If indexed, get stats
	if (indexed) {
		try {
			const db = getDb(config);
			result.file_count = getFileCount(db);
			result.symbol_count = getSymbolCount(db);
			result.last_indexed = config.lastIndexed;

			// Add document statistics
			const documentCount = getDocumentCount(db);
			if (documentCount > 0) {
				result.document_count = documentCount;
				result.documents_by_type = getDocumentCountsByType(db);
			}
		} catch (error) {
			// Database might be corrupt, but we can still report it exists
			result.indexed = false;
		}
	}

	// Check tree-sitter grammar availability (try TypeScript)
	const grammarLanguage = config.language || "typescript";
	try {
		const grammarPath = await findGrammarPath({
			lang: grammarLanguage,
			config,
			projectRoot: config.root,
		});
		result.tree_sitter = {
			available: true,
			language: grammarLanguage,
			grammar_path: grammarPath,
		};
	} catch (error) {
		result.tree_sitter = {
			available: false,
			language: grammarLanguage,
			grammar_path: null,
		};
	}

	return result;
}
