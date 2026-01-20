import { existsSync } from "fs";
import { join } from "path";
import type { InitResult } from "../types.ts";
import {
	createDefaultConfig,
	isInitialized,
	saveConfig,
} from "../utils/config.ts";
import { CtxError } from "../utils/errors.ts";
import { outputJson } from "../utils/output.ts";
import { findRepoRoot, getConfigPath, getDoraDir } from "../utils/paths.ts";
import { copyTemplates } from "../utils/templates.ts";

export async function init(): Promise<void> {
	// Find repository root
	const root = await findRepoRoot();

	// Check if already initialized
	if (isInitialized(root)) {
		throw new CtxError(
			`Repository already initialized. Config exists at ${getConfigPath(root)}`,
		);
	}

	// Create .dora directory
	const doraDir = getDoraDir(root);
	await Bun.write(join(doraDir, ".gitkeep"), "");

	// Copy template files (docs)
	await copyTemplates(doraDir);

	// Add .dora to .gitignore
	await addToGitignore(root);

	// Create and save initial config
	const config = createDefaultConfig(root);
	await saveConfig(config);

	const result: InitResult = {
		success: true,
		root,
		message: "Initialized dora in .dora/",
	};

	outputJson(result);
}

/**
 * Add .dora to .gitignore if not already present
 */
async function addToGitignore(root: string): Promise<void> {
	const gitignorePath = join(root, ".gitignore");

	let content = "";
	if (existsSync(gitignorePath)) {
		content = await Bun.file(gitignorePath).text();
	}

	// Check if .dora is already in .gitignore
	if (content.includes(".dora")) {
		return;
	}

	// Add .dora to .gitignore
	const newContent = content.trim()
		? `${content.trim()}\n\n# dora code context index\n.dora/\n`
		: `# dora code context index\n.dora/\n`;

	await Bun.write(gitignorePath, newContent);
}
