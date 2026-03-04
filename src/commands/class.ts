import { parseClasses } from "../tree-sitter/parser.ts";
import type { ClassResult, ClassInfo } from "../schemas/treesitter.ts";
import { resolveAndValidatePath, setupCommand } from "./shared.ts";
import { getLanguageForExtension } from "../tree-sitter/languages/registry.ts";

export async function classCommand(
	path: string,
	options: {
		sort?: string;
		limit?: number;
	},
): Promise<ClassResult> {
	const ctx = await setupCommand();
	const relativePath = resolveAndValidatePath({ ctx, inputPath: path });

	const absolutePath = `${ctx.config.root}/${relativePath}`;

	const extension = relativePath.includes(".")
		? relativePath.split(".").pop() || ""
		: "";
	const extWithDot = extension ? `.${extension}` : "";
	const languageKey = getLanguageForExtension({ extension: extWithDot }) || "unknown";

	const { classes } = await parseClasses({
		filePath: absolutePath,
		config: ctx.config,
	});

	let filteredClasses = classes;

	const sortBy = options.sort || "name";
	filteredClasses.sort((a: ClassInfo, b: ClassInfo) => {
		switch (sortBy) {
			case "methods":
				return b.methods.length - a.methods.length;
			case "complexity":
				return (b.reference_count || 0) - (a.reference_count || 0);
			case "name":
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
