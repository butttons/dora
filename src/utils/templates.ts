// Template file copying utilities for dora init

import { chmodSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

/**
 * Get the path to the templates directory
 * Uses import.meta.url to get the current file's directory
 */
function getTemplatesDir(): string {
	// Get the directory of the current file (src/utils/)
	const currentDir = dirname(fileURLToPath(import.meta.url));
	// Templates are at src/templates/ relative to src/utils/
	return join(currentDir, "..", "templates");
}

/**
 * Copy a single file if it doesn't exist at target
 * @returns true if copied, false if skipped
 */
async function copyFileIfNotExists(
	sourcePath: string,
	targetPath: string,
	makeExecutable = false,
): Promise<boolean> {
	// Check if target file already exists
	const targetFile = Bun.file(targetPath);
	if (await targetFile.exists()) {
		// Skip - preserve user customizations
		return false;
	}

	// Read source file
	const sourceFile = Bun.file(sourcePath);
	if (!(await sourceFile.exists())) {
		console.warn(`Warning: Template file not found: ${sourcePath}`);
		return false;
	}

	const content = await sourceFile.text();

	// Write to target
	await Bun.write(targetPath, content);

	// Set executable permissions for shell scripts
	if (makeExecutable && sourcePath.endsWith(".sh")) {
		try {
			chmodSync(targetPath, 0o755); // rwxr-xr-x
		} catch (error) {
			// Log warning but don't fail on Windows or permission errors
			console.warn(
				`Warning: Could not set executable permission for ${targetPath}`,
			);
		}
	}

	return true;
}

/**
 * Copy all template files to target .dora directory
 * Creates subdirectories and copies files, skipping existing ones
 */
export async function copyTemplates(targetDoraDir: string): Promise<void> {
	const templatesDir = getTemplatesDir();

	// Define template files to copy
	const templateFiles = [
		{
			source: join(templatesDir, "docs", "SNIPPET.md"),
			target: join(targetDoraDir, "docs", "SNIPPET.md"),
			executable: false,
		},
		{
			source: join(templatesDir, "docs", "SKILL.md"),
			target: join(targetDoraDir, "docs", "SKILL.md"),
			executable: false,
		},
	];

	// Create subdirectories
	const subdirs = [join(targetDoraDir, "docs")];

	for (const dir of subdirs) {
		try {
			mkdirSync(dir, { recursive: true });
		} catch (error) {
			// Directory might already exist, that's fine
		}
	}

	// Copy each template file
	for (const { source, target, executable } of templateFiles) {
		await copyFileIfNotExists(source, target, executable);
	}
}
