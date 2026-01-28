import { searchDocumentContent } from "../../db/queries.ts";
import { parseIntFlag, setupCommand } from "../shared.ts";

const DEFAULT_LIMIT = 20;

export type DocsSearchResult = {
	query: string;
	limit: number;
	results: Array<{
		path: string;
		type: string;
		symbol_refs: number;
		file_refs: number;
	}>;
	total: number;
};

export async function docsSearch(
	query: string,
	flags: Record<string, string | boolean> = {},
): Promise<DocsSearchResult> {
	const ctx = await setupCommand();
	const db = ctx.db;
	const limit = parseIntFlag({
		flags,
		key: "limit",
		defaultValue: DEFAULT_LIMIT,
	});

	if (limit <= 0) {
		throw new Error("Limit must be a positive number");
	}

	const results = searchDocumentContent(db, query, limit);

	return {
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
}
