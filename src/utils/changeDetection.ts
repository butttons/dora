// Change detection utilities for optimizing dora index performance

import { existsSync } from "fs";
import path from "path";
import type { ReindexDecision } from "../types.ts";
import type { Config } from "./config.ts";
import {
	getChangedFilesSinceCommit,
	getCurrentGitCommit,
	hasUncommittedChanges,
	isGitRepo,
} from "./git.ts";
import { resolveAbsolute } from "./paths.ts";

/**
 * Get mtime of a file in seconds (unix timestamp)
 */
async function getFileMtime(filePath: string): Promise<number> {
	try {
		const file = Bun.file(filePath);
		const stat = await file.stat();
		return Math.floor(stat.mtime.getTime() / 1000);
	} catch {
		return 0;
	}
}

/**
 * Main decision function: should we reindex?
 * Returns decision with reason and optionally a list of changed files
 */
export async function shouldReindex({
	config,
	force = false,
}: {
	config: Config;
	force?: boolean;
}): Promise<ReindexDecision> {
	// Force flag bypasses all checks
	if (force) {
		return { shouldReindex: true, reason: "forced" };
	}

	// First run: no previous state
	if (!config.indexState) {
		return { shouldReindex: true, reason: "first run" };
	}

	// Check if we're in a git repo
	const inGitRepo = await isGitRepo();

	if (inGitRepo) {
		// Git-based detection (fast path)
		const decision = await gitBasedDetection(config);
		if (decision) {
			return decision;
		}
	}

	// Fallback: mtime-based detection (for non-git repos or if git fails)
	const decision = await mtimeBasedDetection(config);
	if (decision) {
		return decision;
	}

	// Default: no changes detected
	return { shouldReindex: false, reason: "no changes detected" };
}

/**
 * Git-based change detection
 * Returns decision if changes detected, null if no changes
 */
async function gitBasedDetection(
	config: Config,
): Promise<ReindexDecision | null> {
	try {
		// Get current git state
		const currentCommit = await getCurrentGitCommit();
		const hasUncommitted = await hasUncommittedChanges();

		// Fast path: same commit, no uncommitted changes
		if (
			currentCommit === config.indexState!.gitCommit &&
			!hasUncommitted &&
			!config.indexState!.gitHasUncommitted
		) {
			return { shouldReindex: false, reason: "git: no changes" };
		}

		// Something changed - get the list of changed files
		const changedFiles = await getChangedFilesSinceCommit(
			config.indexState!.gitCommit,
		);

		// Edge case: commit changed but no files actually changed
		// (e.g., merge commit, empty commit)
		if (changedFiles.length === 0 && !hasUncommitted) {
			return {
				shouldReindex: false,
				reason: "git: commit changed but files unchanged",
			};
		}

		// Changes detected
		return {
			shouldReindex: true,
			reason: `git: ${changedFiles.length} files changed`,
			changedFiles,
		};
	} catch (error) {
		// Git command failed - fall back to mtime detection
		return null;
	}
}

/**
 * Mtime-based change detection (fallback for non-git repos)
 * Returns decision if changes detected, null if no changes
 */
async function mtimeBasedDetection(
	config: Config,
): Promise<ReindexDecision | null> {
	try {
		const scipPath = resolveAbsolute({
			root: config.root,
			relativePath: config.scip,
		});
		const databasePath = resolveAbsolute({
			root: config.root,
			relativePath: config.db,
		});

		// Check if files exist
		if (!existsSync(scipPath)) {
			return { shouldReindex: true, reason: "mtime: scip file missing" };
		}

		if (!existsSync(databasePath)) {
			return { shouldReindex: true, reason: "mtime: database missing" };
		}

		// Get current mtimes
		const scipMtime = await getFileMtime(scipPath);
		const databaseMtime = await getFileMtime(databasePath);

		// Check if SCIP file has been modified since last index
		if (scipMtime > config.indexState!.scipMtime) {
			return {
				shouldReindex: true,
				reason: "mtime: scip file updated",
			};
		}

		// Check if database is older than SCIP file (shouldn't happen normally)
		if (databaseMtime < scipMtime) {
			return {
				shouldReindex: true,
				reason: "mtime: database stale",
			};
		}

		// No changes detected
		return { shouldReindex: false, reason: "mtime: no changes" };
	} catch (error) {
		// If mtime check fails, be safe and reindex
		return {
			shouldReindex: true,
			reason: `mtime: check failed (${error})`,
		};
	}
}

/**
 * Get current index state after indexing
 * This should be called after successful indexing to save the state
 */
export async function getCurrentIndexState({
	config,
	fileCount,
	symbolCount,
}: {
	config: Config;
	fileCount: number;
	symbolCount: number;
}) {
	const inGitRepo = await isGitRepo();

	if (inGitRepo) {
		try {
			const gitCommit = await getCurrentGitCommit();
			const gitHasUncommitted = await hasUncommittedChanges();
			const scipPath = resolveAbsolute({
				root: config.root,
				relativePath: config.scip,
			});
			const databasePath = resolveAbsolute({
				root: config.root,
				relativePath: config.db,
			});

			return {
				gitCommit,
				gitHasUncommitted,
				fileCount,
				symbolCount,
				scipMtime: await getFileMtime(scipPath),
				databaseMtime: await getFileMtime(databasePath),
			};
		} catch {
			// Fall through to non-git state
		}
	}

	// Non-git repo or git failed
	const scipPath = resolveAbsolute({
		root: config.root,
		relativePath: config.scip,
	});
	const databasePath = resolveAbsolute({
		root: config.root,
		relativePath: config.db,
	});

	return {
		gitCommit: "",
		gitHasUncommitted: false,
		fileCount,
		symbolCount,
		scipMtime: await getFileMtime(scipPath),
		databaseMtime: await getFileMtime(databasePath),
	};
}
