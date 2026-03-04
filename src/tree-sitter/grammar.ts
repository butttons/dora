import { existsSync } from "fs";
import { join } from "path";
import { CtxError } from "../utils/errors.ts";
import type { Config } from "../utils/config.ts";

let globalNodeModulesPromise: Promise<string | null> | null = null;

async function findGlobalNodeModulesPath(): Promise<string | null> {
	if (globalNodeModulesPromise) {
		return globalNodeModulesPromise;
	}
	globalNodeModulesPromise = (async () => {
		const proc = Bun.spawn(["bun", "pm", "ls", "-g"], {
			stdout: "pipe",
			stderr: "pipe",
		});

		const output = await new Response(proc.stdout).text();
		await proc.exited;

		const firstLine = output.split("\n")[0]?.trim() ?? "";
		const match = firstLine.match(/^(\/.+?)\s+node_modules/);
		if (match && match[1]) {
			return join(match[1], "node_modules");
		}

		return null;
	})();
	return globalNodeModulesPromise;
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
