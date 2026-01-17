// ctx status command

import { getDb } from "../db/connection.ts";
import { getFileCount, getSymbolCount } from "../db/queries.ts";
import type { StatusResult } from "../types.ts";
import { isIndexed, loadConfig } from "../utils/config.ts";
import { outputJson } from "./shared.ts";

export async function status(): Promise<void> {
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
		} catch (error) {
			// Database might be corrupt, but we can still report it exists
			result.indexed = false;
		}
	}

	outputJson(result);
}
