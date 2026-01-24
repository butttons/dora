// Template file copying utilities for dora init

import { mkdirSync } from "fs";
import { join } from "path";

import snippetMd from "../templates/docs/SNIPPET.md" with { type: "text" };
import skillMd from "../templates/docs/SKILL.md" with { type: "text" };
import cookbookIndexMd from "../templates/cookbook/index.md" with {
	type: "text",
};
import cookbookQuickstartMd from "../templates/cookbook/quickstart.md" with {
	type: "text",
};
import cookbookMethodsMd from "../templates/cookbook/methods.md" with {
	type: "text",
};
import cookbookReferencesMd from "../templates/cookbook/references.md" with {
	type: "text",
};
import cookbookExportsMd from "../templates/cookbook/exports.md" with {
	type: "text",
};

/**
 * Copy a single file if it doesn't exist at target
 * @returns true if copied, false if skipped
 */
async function copyFileIfNotExists({
	content,
	targetPath,
}: {
	content: string;
	targetPath: string;
}): Promise<boolean> {
	// Check if target file already exists
	const targetFile = Bun.file(targetPath);
	if (await targetFile.exists()) {
		// Skip - preserve user customizations
		return false;
	}

	// Write to target
	await Bun.write(targetPath, content);

	return true;
}

/**
 * Copy all template files to target .dora directory
 * Creates subdirectories and copies files, skipping existing ones
 */
export async function copyTemplates(targetDoraDir: string): Promise<void> {
	// Define template files to copy with imported content
	const templates = [
		{ content: snippetMd, target: join(targetDoraDir, "docs", "SNIPPET.md") },
		{ content: skillMd, target: join(targetDoraDir, "docs", "SKILL.md") },
		{
			content: cookbookIndexMd,
			target: join(targetDoraDir, "cookbook", "index.md"),
		},
		{
			content: cookbookQuickstartMd,
			target: join(targetDoraDir, "cookbook", "quickstart.md"),
		},
		{
			content: cookbookMethodsMd,
			target: join(targetDoraDir, "cookbook", "methods.md"),
		},
		{
			content: cookbookReferencesMd,
			target: join(targetDoraDir, "cookbook", "references.md"),
		},
		{
			content: cookbookExportsMd,
			target: join(targetDoraDir, "cookbook", "exports.md"),
		},
	];

	// Create subdirectories
	const subdirs = [
		join(targetDoraDir, "docs"),
		join(targetDoraDir, "cookbook"),
	];

	for (const dir of subdirs) {
		try {
			mkdirSync(dir, { recursive: true });
		} catch (error) {
			// Directory might already exist, that's fine
		}
	}

	// Copy each template file
	for (const { content, target } of templates) {
		await copyFileIfNotExists({ content, targetPath: target });
	}
}
