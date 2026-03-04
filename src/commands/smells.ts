import { parseFunctions } from "../tree-sitter/parser.ts";
import type { SmellsResult, SmellItem, FunctionInfo } from "../schemas/treesitter.ts";
import { resolveAndValidatePath, setupCommand } from "./shared.ts";

async function scanTodoComments(params: {
	filePath: string;
}): Promise<Array<{ line: number; text: string }>> {
	const { filePath } = params;

	const file = Bun.file(filePath);
	const content = await file.text();
	const lines = content.split("\n");

	const todoPattern = /TODO|FIXME|HACK/;
	const results: Array<{ line: number; text: string }> = [];

	for (let i = 0; i < lines.length; i++) {
		const lineContent = lines[i] ?? "";
		const commentMatch = lineContent.match(/\/\/(.+)|\/\*(.+?)\*\//);
		if (commentMatch) {
			const commentText = (commentMatch[1] ?? commentMatch[2]) || "";
			if (todoPattern.test(commentText)) {
				results.push({ line: i + 1, text: commentText.trim() });
			}
		}
	}

	return results;
}

function detectFunctionSmells(params: {
	functions: FunctionInfo[];
	complexityThreshold: number;
	locThreshold: number;
	paramsThreshold: number;
}): SmellItem[] {
	const { functions, complexityThreshold, locThreshold, paramsThreshold } = params;
	const smells: SmellItem[] = [];

	for (const fn of functions) {
		if (fn.cyclomatic_complexity > complexityThreshold) {
			smells.push({
				kind: "high_complexity",
				function: fn.name,
				line: fn.lines[0],
				value: fn.cyclomatic_complexity,
				threshold: complexityThreshold,
				message: `Cyclomatic complexity ${fn.cyclomatic_complexity} exceeds threshold ${complexityThreshold}`,
			});
		}

		if (fn.loc > locThreshold) {
			smells.push({
				kind: "long_function",
				function: fn.name,
				line: fn.lines[0],
				value: fn.loc,
				threshold: locThreshold,
				message: `Function length ${fn.loc} lines exceeds threshold ${locThreshold}`,
			});
		}

		if (fn.parameters.length > paramsThreshold) {
			smells.push({
				kind: "too_many_params",
				function: fn.name,
				line: fn.lines[0],
				value: fn.parameters.length,
				threshold: paramsThreshold,
				message: `Parameter count ${fn.parameters.length} exceeds threshold ${paramsThreshold}`,
			});
		}
	}

	return smells;
}

export async function smells(
	path: string,
	options: {
		complexityThreshold?: number;
		locThreshold?: number;
		paramsThreshold?: number;
	},
): Promise<SmellsResult> {
	const ctx = await setupCommand();
	const relativePath = resolveAndValidatePath({ ctx, inputPath: path });
	const absolutePath = `${ctx.config.root}/${relativePath}`;

	const complexityThreshold = options.complexityThreshold ?? 10;
	const locThreshold = options.locThreshold ?? 100;
	const paramsThreshold = options.paramsThreshold ?? 5;

	const { functions } = await parseFunctions({
		filePath: absolutePath,
		config: ctx.config,
	});

	const functionSmells = detectFunctionSmells({
		functions,
		complexityThreshold,
		locThreshold,
		paramsThreshold,
	});

	const todoComments = await scanTodoComments({ filePath: absolutePath });
	const todoSmells: SmellItem[] = todoComments.map((todo) => ({
		kind: "todo_comment",
		function: "",
		line: todo.line,
		value: 1,
		threshold: 0,
		message: `TODO/FIXME/HACK comment: ${todo.text}`,
	}));

	const allSmells = [...functionSmells, ...todoSmells];

	return {
		path: relativePath,
		clean: allSmells.length === 0,
		smells: allSmells,
	};
}
