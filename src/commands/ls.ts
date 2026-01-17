// ctx ls command - list files in a directory from the index

import type { Database } from "bun:sqlite";
import { outputJson, parseIntFlag, setupCommand } from "./shared.ts";

interface LsOptions {
	limit?: number;
	sort?: "path" | "symbols" | "deps" | "rdeps";
}

interface LsFileEntry {
	path: string;
	symbols: number;
	dependencies: number;
	dependents: number;
}

interface LsResult {
	directory: string;
	files: LsFileEntry[];
	total: number;
}

/**
 * Get files in a directory with metadata
 */
function getDirectoryFiles(
	db: Database,
	directoryPath: string,
	options: LsOptions = {},
): LsResult {
	const limit = options.limit || 100;
	const sortBy = options.sort || "path";

	// Map sort option to SQL column
	const orderByMap = {
		path: "f.path",
		symbols: "f.symbol_count DESC",
		deps: "f.dependency_count DESC",
		rdeps: "f.dependent_count DESC",
	};

	const orderBy = orderByMap[sortBy] || "f.path";

	// Query files in directory with metadata
	const pattern = directoryPath ? `${directoryPath}/%` : "%";

	const query = `
    SELECT
      f.path,
      f.symbol_count as symbols,
      f.dependency_count as dependencies,
      f.dependent_count as dependents
    FROM files f
    WHERE f.path LIKE ?
    ORDER BY ${orderBy}
    LIMIT ?
  `;

	const files = db.query(query).all(pattern, limit) as LsFileEntry[];

	// Get total count
	const countQuery = `
    SELECT COUNT(*) as total
    FROM files
    WHERE path LIKE ?
  `;

	const countResult = db.query(countQuery).get(pattern) as { total: number };

	return {
		directory: directoryPath || ".",
		files,
		total: countResult.total,
	};
}

export async function ls(
	directory: string = "",
	flags: Record<string, string | boolean> = {},
): Promise<void> {
	const ctx = await setupCommand();

	const limit = parseIntFlag(flags, "limit", 100);
	const sort = (flags.sort as string) || "path";

	// Validate sort option
	if (!["path", "symbols", "deps", "rdeps"].includes(sort)) {
		throw new Error(
			`Invalid sort option: ${sort}. Use: path, symbols, deps, or rdeps`,
		);
	}

	const result = getDirectoryFiles(ctx.db, directory, { limit, sort });

	outputJson(result);
}
