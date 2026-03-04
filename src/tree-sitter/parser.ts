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
import type { FunctionInfo, ClassInfo, FileMetrics } from "./types.ts";

type ParserModule = typeof import("web-tree-sitter");

const ParserPromise: Promise<ParserModule> = import("web-tree-sitter");

const languageCache = new Map<string, Parser.Language>();

async function getParserModule(): Promise<ParserModule> {
	return await ParserPromise;
}

async function getLanguage(params: {
	grammarPath: string;
}): Promise<Parser.Language> {
	const { grammarPath } = params;

	const cached = languageCache.get(grammarPath);
	if (cached) {
		return cached;
	}

	const mod = await getParserModule();
	await mod.Parser.init();
	const language = await mod.Language.load(grammarPath);
	languageCache.set(grammarPath, language);
	return language;
}

async function getDbConnection(params: {
	config: Config;
}): Promise<Database | null> {
	const { config } = params;
	try {
		return getDb(config);
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
			.get(fileId, symbol.lines[0], symbol.name) as
				| { reference_count: number }
				| null;

		if (symbolRow) {
			symbol.reference_count = symbolRow.reference_count;
		}
	}
}

function calculateFileMetrics(params: {
	content: string;
	functions: FunctionInfo[];
	classes: ClassInfo[];
}): FileMetrics {
	const { content, functions, classes } = params;

	const lines = content.split("\n");
	const totalLines = lines.length;

	let commentLines = 0;
	let blankLines = 0;
	let inBlockComment = false;

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed === "") {
			blankLines++;
			continue;
		}
		if (inBlockComment) {
			commentLines++;
			if (trimmed.endsWith("*/")) {
				inBlockComment = false;
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
				inBlockComment = true;
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

export async function parseFunctions(params: {
	filePath: string;
	config: Config;
}): Promise<{ functions: FunctionInfo[]; metrics: FileMetrics }> {
	const { filePath, config } = params;

	const extension = filePath.includes(".") ? filePath.split(".").pop() || "" : "";
	const extWithDot = extension ? `.${extension}` : "";
	const languageKey = getLanguageForExtension({ extension: extWithDot });

	if (!languageKey) {
		throw new CtxError(`Unsupported file extension: ${extWithDot}`, undefined, {
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
		const file = Bun.file(filePath);
		content = await file.text();
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
	const mod = await getParserModule();

	const parser = new mod.Parser();
	parser.setLanguage(language);

	const tree = parser.parse(content);
	if (!tree) {
		throw new CtxError("Failed to parse file", undefined, { filePath });
	}

	const queries = langEntry.getQueries();

	const functionQuery = new mod.Query(language, queries.functionQuery);
	const functionCaptures = functionQuery.captures(tree.rootNode);

	const classQuery = new mod.Query(language, queries.classQuery);
	const classCaptures = classQuery.captures(tree.rootNode);

	const parseResults = queries.parseResults({
		functionCaptures,
		classCaptures,
	});

	const db = await getDbConnection({ config });

	await correlateWithScip({
		db,
		filePath,
		symbols: parseResults.functions,
	});

	const metrics = calculateFileMetrics({
		content,
		functions: parseResults.functions,
		classes: parseResults.classes,
	});

	parser.delete();
	tree.delete();

	return {
		functions: parseResults.functions,
		metrics,
	};
}

export async function parseClasses(params: {
	filePath: string;
	config: Config;
}): Promise<{ classes: ClassInfo[] }> {
	const { filePath, config } = params;

	const extension = filePath.includes(".") ? filePath.split(".").pop() || "" : "";
	const extWithDot = extension ? `.${extension}` : "";
	const languageKey = getLanguageForExtension({ extension: extWithDot });

	if (!languageKey) {
		throw new CtxError(`Unsupported file extension: ${extWithDot}`, undefined, {
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
		const file = Bun.file(filePath);
		content = await file.text();
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
	const mod = await getParserModule();

	const parser = new mod.Parser();
	parser.setLanguage(language);

	const tree = parser.parse(content);
	if (!tree) {
		throw new CtxError("Failed to parse file", undefined, { filePath });
	}

	const queries = langEntry.getQueries();

	const functionQuery = new mod.Query(language, queries.functionQuery);
	const functionCaptures = functionQuery.captures(tree.rootNode);

	const classQuery = new mod.Query(language, queries.classQuery);
	const classCaptures = classQuery.captures(tree.rootNode);

	const parseResults = queries.parseResults({
		functionCaptures,
		classCaptures,
	});

	const db = await getDbConnection({ config });

	await correlateWithScip({
		db,
		filePath,
		symbols: parseResults.classes,
	});

	parser.delete();
	tree.delete();

	return {
		classes: parseResults.classes,
	};
}
