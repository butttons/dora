import { searchDocumentContent } from "../../db/queries.ts";
import { outputJson, parseIntFlag, setupCommand } from "../shared.ts";

const DEFAULT_LIMIT = 20;

export async function docsSearch(
	query: string,
	flags: Record<string, string | boolean> = {},
): Promise<void> {
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
}
