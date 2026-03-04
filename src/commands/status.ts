import { getDb } from "../db/connection.ts";
import {
	getDocumentCount,
	getDocumentCountsByType,
	getFileCount,
	getSymbolCount,
} from "../db/queries.ts";
import { findGrammarPath } from "../tree-sitter/grammar.ts";
import { languageRegistry } from "../tree-sitter/languages/registry.ts";
import type { StatusResult } from "../types.ts";
import { isIndexed, loadConfig } from "../utils/config.ts";

export async function status(): Promise<StatusResult> {
	const config = await loadConfig();
	const isIndexedRepo = await isIndexed(config);

	const result: StatusResult = {
		initialized: true,
		indexed: isIndexedRepo,
	};

	if (isIndexedRepo) {
		try {
			const db = getDb(config);
			result.file_count = getFileCount(db);
			result.symbol_count = getSymbolCount(db);
			result.last_indexed = config.lastIndexed;

			const documentCount = getDocumentCount(db);
			if (documentCount > 0) {
				result.document_count = documentCount;
				result.documents_by_type = getDocumentCountsByType(db);
			}
		} catch {
			result.indexed = false;
		}
	}

	const grammarResults = await Promise.all(
		Object.keys(languageRegistry).map(async (lang) => {
			try {
				const grammarPath = await findGrammarPath({
					lang,
					config,
					projectRoot: config.root,
				});
				return { language: lang, available: true, grammar_path: grammarPath };
			} catch {
				return { language: lang, available: false, grammar_path: null };
			}
		}),
	);

	result.tree_sitter = { grammars: grammarResults };

	return result;
}
