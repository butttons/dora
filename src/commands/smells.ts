import { parseFunctions, parseClasses } from "../tree-sitter/parser.ts";
import type {
	ClassInfo,
	FunctionInfo,
	SmellItem,
	SmellsResult,
} from "../schemas/treesitter.ts";
import { CtxError } from "../utils/errors.ts";
import { resolveAndValidatePath, setupCommand } from "./shared.ts";
import { resolveAbsolute } from "../utils/paths.ts";

type TodoComment = {
	line: number;
	text: string;
};

type SmellsOptions = {
	complexityThreshold?: number;
	locThreshold?: number;
	paramsThreshold?: number;
	methodsThreshold?: number;
	propertiesThreshold?: number;
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
	let isInBlockComment = false;

	for (let index = 0; index < lines.length; index++) {
		const lineContent = lines[index] ?? "";
		const trimmed = lineContent.trim();

		if (isInBlockComment) {
			if (todoPattern.test(trimmed)) {
				results.push({ line: index + 1, text: trimmed });
			}
			if (trimmed.includes("*/")) {
				isInBlockComment = false;
			}
			continue;
		}

		if (trimmed.startsWith("/*")) {
			isInBlockComment = !trimmed.includes("*/");
			const commentText = trimmed.replace(/^\/\*+/, "").replace(/\*\/$/, "").trim();
			if (todoPattern.test(commentText)) {
				results.push({ line: index + 1, text: commentText });
			}
			continue;
		}

		const lineCommentMatch = trimmed.match(/\/\/(.+)/);
		if (lineCommentMatch) {
			const commentText = lineCommentMatch[1] ?? "";
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
	const { functions, complexityThreshold, locThreshold, paramsThreshold } =
		params;
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

function detectClassSmells(params: {
	classes: ClassInfo[];
	methodsThreshold: number;
	propertiesThreshold: number;
}): SmellItem[] {
	const { classes, methodsThreshold, propertiesThreshold } = params;
	const smells: SmellItem[] = [];

	for (const cls of classes) {
		if (cls.methods.length > methodsThreshold) {
			smells.push({
				kind: "god_class",
				function: cls.name,
				line: cls.lines[0],
				value: cls.methods.length,
				threshold: methodsThreshold,
				message: `Class has ${cls.methods.length} methods, exceeds threshold ${methodsThreshold}`,
			});
		}

		if (cls.property_count > propertiesThreshold) {
			smells.push({
				kind: "large_class",
				function: cls.name,
				line: cls.lines[0],
				value: cls.property_count,
				threshold: propertiesThreshold,
				message: `Class has ${cls.property_count} properties, exceeds threshold ${propertiesThreshold}`,
			});
		}
	}

	return smells;
}

export async function smells(params: SmellsParams): Promise<SmellsResult> {
	const { path, options = {} } = params;
	const ctx = await setupCommand();
	const relativePath = resolveAndValidatePath({ ctx, inputPath: path });
	const absolutePath = resolveAbsolute({ root: ctx.config.root, relativePath });

	const complexityThreshold = options.complexityThreshold ?? 10;
	const locThreshold = options.locThreshold ?? 100;
	const paramsThreshold = options.paramsThreshold ?? 5;
	const methodsThreshold = options.methodsThreshold ?? 20;
	const propertiesThreshold = options.propertiesThreshold ?? 15;

	const [{ functions }, { classes }] = await Promise.all([
		parseFunctions({ filePath: absolutePath, config: ctx.config }),
		parseClasses({ filePath: absolutePath, config: ctx.config }),
	]);

	const functionSmells = detectFunctionSmells({
		functions,
		complexityThreshold,
		locThreshold,
		paramsThreshold,
	});

	const classSmells = detectClassSmells({
		classes,
		methodsThreshold,
		propertiesThreshold,
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

	const allSmells = [...functionSmells, ...classSmells, ...todoSmells];
	const isClean = allSmells.length === 0;

	return {
		path: relativePath,
		clean: isClean,
		smells: allSmells,
	};
}
