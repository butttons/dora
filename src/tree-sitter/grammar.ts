import { existsSync } from "fs";
import { join } from "path";
import { CtxError } from "../utils/errors.ts";
import type { Config } from "../utils/config.ts";

async function findGlobalNodeModulesPath(): Promise<string | null> {
	const proc = Bun.spawn(["bun", "pm", "ls", "-g"], {
		stdout: "pipe",
		stderr: "pipe",
	});

	const output = await new Response(proc.stdout).text();
	await proc.exited;

	const lines = output.split("\n");
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith("/") && trimmed.includes("node_modules")) {
			const match = trimmed.match(/^(.+\/node_modules)/);
			if (match && match[1]) {
				return match[1];
			}
		}
	}

	return null;
}

export async function findGrammarPath(params: {
	lang: string;
	config: Config;
	projectRoot: string;
}): Promise<string> {
	const { lang, config, projectRoot } = params;

	const treeSitterConfig = config.treeSitter;
	if (treeSitterConfig?.grammars?.[lang]) {
		const explicitPath = treeSitterConfig.grammars[lang];
		if (existsSync(explicitPath)) {
			return explicitPath;
		}
	}

	const wasmFileName = `tree-sitter-${lang}.wasm`;
	const localPath = join(
		projectRoot,
		"node_modules",
		`tree-sitter-${lang}`,
		wasmFileName,
	);
	if (existsSync(localPath)) {
		return localPath;
	}

	const globalNodeModules = await findGlobalNodeModulesPath();
	if (globalNodeModules) {
		const globalPath = join(
			globalNodeModules,
			`tree-sitter-${lang}`,
			wasmFileName,
		);
		if (existsSync(globalPath)) {
			return globalPath;
		}
	}

	throw new CtxError(
		`tree-sitter-${lang} grammar not found. Install it: bun add tree-sitter-${lang}`,
	);
}
