import { getLanguageForExtension } from "../tree-sitter/languages/registry.ts";
import { parseFunctions } from "../tree-sitter/parser.ts";
import type { FnResult, FunctionInfo } from "../schemas/treesitter.ts";
import { resolveAndValidatePath, setupCommand } from "./shared.ts";
import { resolveAbsolute } from "../utils/paths.ts";

type FnOptions = {
	sort?: string;
	minComplexity?: number;
	limit?: number;
};

type FnParams = {
	path: string;
	options?: FnOptions;
};

export async function fn(params: FnParams): Promise<FnResult> {
	const { path, options = {} } = params;
	const ctx = await setupCommand();
	const relativePath = resolveAndValidatePath({ ctx, inputPath: path });
	const absolutePath = resolveAbsolute({ root: ctx.config.root, relativePath });

	const extension = relativePath.includes(".")
		? relativePath.split(".").pop() || ""
		: "";
	const extWithDot = extension ? `.${extension}` : "";
	const languageKey =
		getLanguageForExtension({ extension: extWithDot }) || "unknown";

	const { functions, metrics } = await parseFunctions({
		filePath: absolutePath,
		config: ctx.config,
	});

	let filteredFunctions = functions;

	const minComplexity = options.minComplexity;
	if (minComplexity !== undefined && minComplexity > 0) {
		filteredFunctions = filteredFunctions.filter(
			(item) => item.cyclomatic_complexity >= minComplexity,
		);
	}

	const sortBy = options.sort || "complexity";
	const validSorts = ["complexity", "loc", "name"] as const;
	if (!validSorts.includes(sortBy as (typeof validSorts)[number])) {
		throw new Error(`Invalid sort value "${sortBy}". Valid values: ${validSorts.join(", ")}`);
	}
	filteredFunctions.sort((a: FunctionInfo, b: FunctionInfo) => {
		switch (sortBy) {
			case "loc":
				return b.loc - a.loc;
			case "name":
				return a.name.localeCompare(b.name);
			default:
				return b.cyclomatic_complexity - a.cyclomatic_complexity;
		}
	});

	const limit = options.limit;
	if (limit !== undefined && limit > 0) {
		filteredFunctions = filteredFunctions.slice(0, limit);
	}

	return {
		path: relativePath,
		language: languageKey,
		functions: filteredFunctions,
		file_stats: metrics,
	};
}
