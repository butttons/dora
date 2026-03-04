import { parseFunctions } from "../tree-sitter/parser.ts";
import type {
	FunctionInfo,
	SmellItem,
	SmellsResult,
} from "../schemas/treesitter.ts";
import { CtxError } from "../utils/errors.ts";
import { resolveAndValidatePath, setupCommand } from "./shared.ts";

type TodoComment = {
	line: number;
	text: string;
};

type SmellsOptions = {
	complexityThreshold?: number;
	locThreshold?: number;
	paramsThreshold?: number;
};

type SmellsParams = {
	path: string;
	options?: SmellsOptions;
};

async function scanTodoComments(params: {
	filePath: string;
}): Promise<TodoComment[]> {
	const { filePath } = params;

	let content: string;
	try {
		content = await Bun.file(filePath).text();
	} catch (error) {
		throw new CtxError(
			`Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
			undefined,
			{ filePath },
		);
	}

	const lines = content.split("\n");
	const todoPattern = /TODO|FIXME|HACK/;
	const results: TodoComment[] = [];

	for (let index = 0; index < lines.length; index++) {
		const lineContent = lines[index] ?? "";
		const commentMatch = lineContent.match(/\/\/(.+)|\/\*(.+?)\*\//);
		if (commentMatch) {
			const commentText = (commentMatch[1] ?? commentMatch[2]) || "";
			if (todoPattern.test(commentText)) {
				results.push({ line: index + 1, text: commentText.trim() });
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

	for (const fnItem of functions) {
		if (fnItem.cyclomatic_complexity > complexityThreshold) {
			smells.push({
				kind: "high_complexity",
				function: fnItem.name,
				line: fnItem.lines[0],
				value: fnItem.cyclomatic_complexity,
				threshold: complexityThreshold,
				message: `Cyclomatic complexity ${fnItem.cyclomatic_complexity} exceeds threshold ${complexityThreshold}`,
			});
		}

		if (fnItem.loc > locThreshold) {
			smells.push({
				kind: "long_function",
				function: fnItem.name,
				line: fnItem.lines[0],
				value: fnItem.loc,
				threshold: locThreshold,
				message: `Function length ${fnItem.loc} lines exceeds threshold ${locThreshold}`,
			});
		}

		if (fnItem.parameters.length > paramsThreshold) {
			smells.push({
				kind: "too_many_params",
				function: fnItem.name,
				line: fnItem.lines[0],
				value: fnItem.parameters.length,
				threshold: paramsThreshold,
				message: `Parameter count ${fnItem.parameters.length} exceeds threshold ${paramsThreshold}`,
			});
		}
	}

	return smells;
}

export async function smells(params: SmellsParams): Promise<SmellsResult> {
	const { path, options = {} } = params;
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
	const isClean = allSmells.length === 0;

	return {
		path: relativePath,
		clean: isClean,
		smells: allSmells,
	};
}
