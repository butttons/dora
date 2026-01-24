// Path resolution utilities

import { existsSync } from "fs";
import { dirname, join, relative, resolve } from "path";

/**
 * Find repository root by walking up to find package.json or tsconfig.json
 */
export async function findRepoRoot(
	startPath: string = process.cwd(),
): Promise<string> {
	let currentPath = resolve(startPath);

	while (true) {
		// Check for common project files
		if (
			existsSync(join(currentPath, "package.json")) ||
			existsSync(join(currentPath, "tsconfig.json")) ||
			existsSync(join(currentPath, "go.mod")) ||
			existsSync(join(currentPath, "Cargo.toml")) ||
			existsSync(join(currentPath, "pom.xml")) ||
			existsSync(join(currentPath, "build.gradle")) ||
			existsSync(join(currentPath, "pyproject.toml")) ||
			existsSync(join(currentPath, "setup.py")) ||
			existsSync(join(currentPath, "requirements.txt")) ||
			existsSync(join(currentPath, ".git"))
		) {
			return currentPath;
		}

		const parentPath = dirname(currentPath);

		// Reached filesystem root
		if (parentPath === currentPath) {
			throw new Error(
				"Could not find repository root. No package.json, tsconfig.json, or other project file found.",
			);
		}

		currentPath = parentPath;
	}
}

/**
 * Resolve path to absolute from repo root
 */
export function resolveAbsolute({
	root,
	relativePath,
}: {
	root: string;
	relativePath: string;
}): string {
	return resolve(root, relativePath);
}

/**
 * Convert absolute path to relative from repo root
 */
export function resolveRelative({
	root,
	absolutePath,
}: {
	root: string;
	absolutePath: string;
}): string {
	return relative(root, absolutePath);
}

/**
 * Get .dora directory path from repo root
 */
export function getDoraDir(root: string): string {
	return join(root, ".dora");
}

/**
 * Get config.json path
 */
export function getConfigPath(root: string): string {
	return join(getDoraDir(root), "config.json");
}

/**
 * Normalize a path to be relative to the repo root.
 * If the path is already relative, returns it unchanged.
 * If the path is absolute, converts it to relative.
 */
export function normalizeToRelative({
	root,
	inputPath,
}: {
	root: string;
	inputPath: string;
}): string {
	if (inputPath.startsWith("/")) {
		return resolveRelative({ root, absolutePath: inputPath });
	}
	return inputPath;
}
