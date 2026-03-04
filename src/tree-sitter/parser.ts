import type Parser from "web-tree-sitter";
import type { Config } from "../utils/config.ts";
import { CtxError } from "../utils/errors.ts";
import type { Database } from "bun:sqlite";
import { getDb } from "../db/connection.ts";
import { findGrammarPath } from "./grammar.ts";
import {
	getLanguageForExtension,
	getLanguageEntry,
} from "./languages/registry.ts";
import type {
	FunctionInfo,
	ClassInfo,
	FileMetrics,
} from "../schemas/treesitter.ts";

type ParserModule = typeof import("web-tree-sitter");

const parserModulePromise: Promise<ParserModule> = import("web-tree-sitter");

const languageCache = new Map<string, Parser.Language>();

let parserInitPromise: Promise<ParserModule> | null = null;

async function getInitializedModule(): Promise<ParserModule> {
	if (parserInitPromise) {
		return parserInitPromise;
	}
	parserInitPromise = parserModulePromise.then(async (mod) => {
		const wasmPath = import.meta
			.resolve("web-tree-sitter/web-tree-sitter.wasm")
			.replace("file://", "");
		await mod.Parser.init({ locateFile: () => wasmPath });
		return mod;
	});
	return parserInitPromise;
}

async function getLanguage(params: {
	grammarPath: string;
}): Promise<Parser.Language> {
	const { grammarPath } = params;

	const cached = languageCache.get(grammarPath);
	if (cached) {
		return cached;
	}

	const mod = await getInitializedModule();
	const language = await mod.Language.load(grammarPath);
	languageCache.set(grammarPath, language);
	return language;
}

function getDbConnection(params: { config: Config }): Database | null {
	try {
		return getDb(params.config);
	} catch {
		return null;
	}
}

async function correlateWithScip(params: {
	db: Database | null;
	filePath: string;
	symbols: Array<FunctionInfo | ClassInfo>;
}): Promise<void> {
	const { db, filePath, symbols } = params;
	if (!db || symbols.length === 0) return;

	const fileRow = db
		.query("SELECT id FROM files WHERE path = ?")
		.get(filePath) as { id: number } | null;
	if (!fileRow) return;

	const fileId = fileRow.id;

	for (const symbol of symbols) {
		const symbolRow = db
			.query(
				`SELECT reference_count FROM symbols
         WHERE file_id = ? AND start_line = ? AND name = ?
         LIMIT 1`,
			)
			.get(fileId, symbol.lines[0], symbol.name) as {
			reference_count: number;
		} | null;

		if (symbolRow) {
			symbol.reference_count = symbolRow.reference_count;
		}
	}
}

export function calculateFileMetrics(params: {
	content: string;
	functions: FunctionInfo[];
	classes: ClassInfo[];
}): FileMetrics {
	const { content, functions, classes } = params;

	const lines = content.split("\n");
	const totalLines = lines.length;

	let commentLines = 0;
	let blankLines = 0;
	let isInBlockComment = false;

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed === "") {
			blankLines++;
			continue;
		}
		if (isInBlockComment) {
			commentLines++;
			if (trimmed.endsWith("*/")) {
				isInBlockComment = false;
			}
			continue;
		}
		if (trimmed.startsWith("//")) {
			commentLines++;
			continue;
		}
		if (trimmed.startsWith("/*")) {
			commentLines++;
			if (!trimmed.endsWith("*/")) {
				isInBlockComment = true;
			}
			continue;
		}
	}

	const sloc = totalLines - commentLines - blankLines;

	const complexities = functions.map((f) => f.cyclomatic_complexity);
	const avgComplexity =
		complexities.length > 0
			? complexities.reduce((a, b) => a + b, 0) / complexities.length
			: 0;
	const maxComplexity = complexities.length > 0 ? Math.max(...complexities) : 0;

	return {
		loc: totalLines,
		sloc,
		comment_lines: commentLines,
		blank_lines: blankLines,
		function_count: functions.length,
		class_count: classes.length,
		avg_complexity: Math.round(avgComplexity * 100) / 100,
		max_complexity: maxComplexity,
	};
}

type ParsedFile = {
	functions: FunctionInfo[];
	classes: ClassInfo[];
	metrics: FileMetrics;
};

async function parseFile(params: {
	filePath: string;
	config: Config;
}): Promise<ParsedFile> {
	const { filePath, config } = params;

	const extension = filePath.includes(".")
		? `.${filePath.split(".").pop() || ""}`
		: "";
	const languageKey = getLanguageForExtension({ extension });

	if (!languageKey) {
		throw new CtxError(`Unsupported file extension: ${extension}`, undefined, {
			filePath,
		});
	}

	const langEntry = getLanguageEntry({ language: languageKey });
	if (!langEntry) {
		throw new CtxError(
			`Language entry not found for: ${languageKey}`,
			undefined,
			{ filePath },
		);
	}

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

	const grammarPath = await findGrammarPath({
		lang: languageKey,
		config,
		projectRoot: config.root,
	});

	const language = await getLanguage({ grammarPath });
	const mod = await getInitializedModule();

	const parser = new mod.Parser();
	parser.setLanguage(language);

	const tree = parser.parse(content);
	if (!tree) {
		throw new CtxError("Failed to parse file", undefined, { filePath });
	}

	const queries = langEntry.getQueries();
	const functionCaptures = new mod.Query(
		language,
		queries.functionQuery,
	).captures(tree.rootNode);
	const classCaptures = new mod.Query(language, queries.classQuery).captures(
		tree.rootNode,
	);

	const parseResults = queries.parseResults({
		functionCaptures,
		classCaptures,
	});

	parser.delete();
	tree.delete();

	const metrics = calculateFileMetrics({
		content,
		functions: parseResults.functions,
		classes: parseResults.classes,
	});

	return {
		functions: parseResults.functions,
		classes: parseResults.classes,
		metrics,
	};
}

export async function parseFunctions(params: {
	filePath: string;
	config: Config;
}): Promise<{ functions: FunctionInfo[]; metrics: FileMetrics }> {
	const { filePath, config } = params;
	const parsed = await parseFile({ filePath, config });

	const db = getDbConnection({ config });
	await correlateWithScip({ db, filePath, symbols: parsed.functions });

	return {
		functions: parsed.functions,
		metrics: parsed.metrics,
	};
}

export async function parseClasses(params: {
	filePath: string;
	config: Config;
}): Promise<{ classes: ClassInfo[] }> {
	const { filePath, config } = params;
	const parsed = await parseFile({ filePath, config });

	const db = getDbConnection({ config });
	await correlateWithScip({ db, filePath, symbols: parsed.classes });

	return {
		classes: parsed.classes,
	};
}
