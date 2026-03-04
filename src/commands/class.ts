import { getLanguageForExtension } from "../tree-sitter/languages/registry.ts";
import { parseClasses } from "../tree-sitter/parser.ts";
import type { ClassInfo, ClassResult } from "../schemas/treesitter.ts";
import { resolveAndValidatePath, setupCommand } from "./shared.ts";
import { resolveAbsolute } from "../utils/paths.ts";

type ClassCommandOptions = {
	sort?: string;
	limit?: number;
};

type ClassCommandParams = {
	path: string;
	options?: ClassCommandOptions;
};

function getClassComplexity(params: { item: ClassInfo }): number {
	const { item } = params;
	return item.methods.reduce(
		(total, method) => total + method.cyclomatic_complexity,
		0,
	);
}

export async function classCommand(
	params: ClassCommandParams,
): Promise<ClassResult> {
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

	const { classes } = await parseClasses({
		filePath: absolutePath,
		config: ctx.config,
	});

	let filteredClasses = classes;

	const sortBy = options.sort || "name";
	const validSorts = ["name", "methods", "complexity"] as const;
	if (!validSorts.includes(sortBy as (typeof validSorts)[number])) {
		throw new Error(`Invalid sort value "${sortBy}". Valid values: ${validSorts.join(", ")}`);
	}
	filteredClasses.sort((a: ClassInfo, b: ClassInfo) => {
		switch (sortBy) {
			case "methods":
				return b.methods.length - a.methods.length;
			case "complexity":
				return (
					getClassComplexity({ item: b }) - getClassComplexity({ item: a })
				);
			default:
				return a.name.localeCompare(b.name);
		}
	});

	const limit = options.limit;
	if (limit !== undefined && limit > 0) {
		filteredClasses = filteredClasses.slice(0, limit);
	}

	return {
		path: relativePath,
		language: languageKey,
		classes: filteredClasses,
	};
}
