// Git utility functions

import { $ } from "bun";

/**
 * Get list of files changed since a git ref (commit, branch, tag)
 * Returns relative paths
 */
export async function getChangedFiles(ref: string): Promise<string[]> {
	try {
		const result = await $`git diff --name-only ${ref}`.text();
		const files = result
			.split("\n")
			.map((f) => f.trim())
			.filter(Boolean);
		return files;
	} catch (error) {
		throw new Error(`Failed to get changed files from git: ${error}`);
	}
}

/**
 * Check if current directory is a git repository
 */
export async function isGitRepo(): Promise<boolean> {
	try {
		await $`git rev-parse --git-dir`.quiet();
		return true;
	} catch {
		return false;
	}
}

/**
 * Get the current git commit hash (HEAD)
 */
export async function getCurrentGitCommit(): Promise<string> {
	try {
		const result = await $`git rev-parse HEAD`.text();
		return result.trim();
	} catch (error) {
		throw new Error(`Failed to get current git commit: ${error}`);
	}
}

/**
 * Check if there are uncommitted changes (staged, unstaged, or untracked)
 */
export async function hasUncommittedChanges(): Promise<boolean> {
	try {
		const result = await $`git status --porcelain`.text();
		return result.trim().length > 0;
	} catch (error) {
		throw new Error(`Failed to check for uncommitted changes: ${error}`);
	}
}

/**
 * Get list of files changed since a specific commit hash
 * Includes: committed changes, uncommitted changes, and untracked files
 */
export async function getChangedFilesSinceCommit(
	commitHash: string,
): Promise<string[]> {
	try {
		// Get files changed between commit and HEAD
		const committedResult =
			await $`git diff --name-only ${commitHash} HEAD`.text();
		const committedFiles = committedResult
			.split("\n")
			.map((f) => f.trim())
			.filter(Boolean);

		// Get uncommitted changes (staged and unstaged)
		const uncommittedResult = await $`git diff --name-only HEAD`.text();
		const uncommittedFiles = uncommittedResult
			.split("\n")
			.map((f) => f.trim())
			.filter(Boolean);

		// Get untracked files
		const untrackedResult =
			await $`git ls-files --others --exclude-standard`.text();
		const untrackedFiles = untrackedResult
			.split("\n")
			.map((f) => f.trim())
			.filter(Boolean);

		// Combine all files and deduplicate
		const allFiles = new Set([
			...committedFiles,
			...uncommittedFiles,
			...untrackedFiles,
		]);

		return Array.from(allFiles);
	} catch (error) {
		throw new Error(`Failed to get changed files since commit: ${error}`);
	}
}
