import { existsSync } from "fs";
import { join } from "path";
import type { InitResult } from "../types.ts";
import {
	LanguageSchema,
	createDefaultConfig,
	isInitialized,
	saveConfig,
} from "../utils/config.ts";
import { CtxError } from "../utils/errors.ts";
import { outputJson } from "../utils/output.ts";
import { findRepoRoot, getConfigPath, getDoraDir } from "../utils/paths.ts";
import { copyTemplates } from "../utils/templates.ts";

export async function init(params?: { language?: string }): Promise<void> {
	if (params?.language) {
		const result = LanguageSchema.safeParse(params.language);
		if (!result.success) {
			throw new CtxError(
				`Invalid language: ${params.language}. Valid options are: ${LanguageSchema.options.join(", ")}`,
			);
		}
	}

	const root = params?.language ? process.cwd() : await findRepoRoot();

	if (isInitialized(root)) {
		throw new CtxError(
			`Repository already initialized. Config exists at ${getConfigPath(root)}`,
		);
	}

	const doraDir = getDoraDir(root);
	await Bun.write(join(doraDir, ".gitkeep"), "");

	await copyTemplates(doraDir);

	await addToGitignore(root);

	const config = createDefaultConfig({
		root,
		language: params?.language,
	});
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

	if (content.includes(".dora")) {
		return;
	}

	const newContent = content.trim()
		? `${content.trim()}\n\n# dora code context index\n.dora/\n`
		: `# dora code context index\n.dora/\n`;

	await Bun.write(gitignorePath, newContent);
}
