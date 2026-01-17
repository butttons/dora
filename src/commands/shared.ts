// Shared command utilities to reduce boilerplate and duplication

import type { Database } from "bun:sqlite";
import { getDb } from "../db/connection.ts";
import {
	fileExists,
	findIndexFile,
	getFilesInDirectory,
} from "../db/queries.ts";
import { loadConfig, type Config } from "../utils/config.ts";
import { CtxError } from "../utils/errors.ts";
import { outputJson } from "../utils/output.ts";
import { normalizeToRelative } from "../utils/paths.ts";

// Default values for common flags
export const DEFAULTS = {
	DEPTH: 1,
	SYMBOL_LIMIT: 20,
	REFS_LIMIT: 100,
	UNUSED_LIMIT: 50,
	HOTSPOTS_LIMIT: 10,
	MAX_PATH_DEPTH: 10,
	LEAF_MAX_DEPENDENTS: 0,
} as const;

/**
 * Command context with config and database connection.
 * Reduces boilerplate: config loading + db connection is done once.
 */
export interface CommandContext {
	config: Config;
	db: Database;
}

/**
 * Set up command context (config + database).
 * Most commands need this exact setup.
 */
export async function setupCommand(): Promise<CommandContext> {
	const config = await loadConfig();
	const db = getDb(config);
	return { config, db };
}

/**
 * Parse an integer flag with a default value.
 */
export function parseIntFlag(
	flags: Record<string, string | boolean>,
	key: string,
	defaultValue: number,
): number {
	const value = flags[key];
	if (value === undefined || value === true) {
		return defaultValue;
	}
	const parsed = parseInt(value as string, 10);
	return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse a string flag with a default value.
 */
export function parseStringFlag(
	flags: Record<string, string | boolean>,
	key: string,
	defaultValue: string,
): string {
	const value = flags[key];
	if (value === undefined || value === true) {
		return defaultValue;
	}
	return value as string;
}

/**
 * Parse an optional string flag (returns undefined if not provided).
 */
export function parseOptionalStringFlag(
	flags: Record<string, string | boolean>,
	key: string,
): string | undefined {
	const value = flags[key];
	if (value === undefined || value === true) {
		return undefined;
	}
	return value as string;
}

/**
 * Normalize path and validate it exists in the database.
 * Supports auto-resolution of directories to index files (SQL-based).
 *
 * If path resolves to a file, returns the file path.
 * If path is a directory without index, outputs helpful info and exits.
 * If path is a typo with suggestions, outputs suggestions and exits.
 * Otherwise throws CtxError.
 */
export function resolveAndValidatePath(
	ctx: CommandContext,
	inputPath: string,
): string {
	const relativePath = normalizeToRelative(ctx.config.root, inputPath);

	// First, try exact file match (fast path for explicit files)
	if (fileExists(ctx.db, relativePath)) {
		return relativePath;
	}

	// Check if there are files in the database matching this as a directory
	const filesInDir = getFilesInDirectory(ctx.db, relativePath, {
		limit: 10,
		exactMatch: true,
	});

	if (filesInDir.length > 0) {
		// Looks like a directory - try to find an index file
		const indexFile = findIndexFile(ctx.db, relativePath);

		if (indexFile) {
			return indexFile;
		}

		// No index file found - output helpful info and exit successfully
		outputJson({
			message: "Directory has no index file",
			directory: relativePath,
			available_files: filesInDir,
			tip: "Use a specific file path or create an index file",
		});
		process.exit(0);
	}

	// Not an exact match and not a directory - might be a partial path or typo
	const matchingFiles = getFilesInDirectory(ctx.db, relativePath, {
		limit: 10,
		exactMatch: false,
	});

	if (matchingFiles.length > 0) {
		// Output suggestions and exit successfully
		outputJson({
			message: "File not found - showing suggestions",
			path: relativePath,
			suggestions: matchingFiles,
			tip: "Use one of the suggested file paths",
		});
		process.exit(0);
	}

	// No matches at all - this is a real error
	throw new CtxError(
		"File not found in index",
		undefined,
		{
			path: relativePath,
		},
	);
}

/**
 * Normalize path without validation (for cases where we want to check existence separately).
 */
export function resolvePath(ctx: CommandContext, inputPath: string): string {
	return normalizeToRelative(ctx.config.root, inputPath);
}

// Re-export for convenience
export { outputJson };
