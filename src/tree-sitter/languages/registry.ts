import type Parser from "web-tree-sitter";
import type { ClassInfo, FunctionInfo } from "../../schemas/treesitter.ts";
import * as typescriptLang from "./typescript.ts";
import * as javascriptLang from "./javascript.ts";

export type LanguageQueries = {
	functionQuery: string;
	classQuery: string;
	parseResults: (params: {
		functionCaptures: Parser.QueryCapture[];
		classCaptures: Parser.QueryCapture[];
	}) => { functions: FunctionInfo[]; classes: ClassInfo[] };
};

export type LanguageEntry = {
	grammarName: string;
	extensions: string[];
	getQueries: () => LanguageQueries;
};

function buildTypescriptQueries(): LanguageQueries {
	return {
		functionQuery: typescriptLang.functionQueryString,
		classQuery: typescriptLang.classQueryString,
		parseResults: (params) => ({
			functions: typescriptLang.parseFunctionCaptures(params.functionCaptures),
			classes: typescriptLang.parseClassCaptures(params.classCaptures),
		}),
	};
}

function buildJavascriptQueries(): LanguageQueries {
	return {
		functionQuery: javascriptLang.functionQueryString,
		classQuery: javascriptLang.classQueryString,
		parseResults: (params) => ({
			functions: javascriptLang.parseFunctionCaptures(params.functionCaptures),
			classes: javascriptLang.parseClassCaptures(params.classCaptures),
		}),
	};
}

export const languageRegistry: Record<string, LanguageEntry> = {
	typescript: {
		grammarName: "tree-sitter-typescript",
		extensions: [".ts"],
		getQueries: buildTypescriptQueries,
	},
	tsx: {
		grammarName: "tree-sitter-tsx",
		extensions: [".tsx"],
		getQueries: buildTypescriptQueries,
	},
	javascript: {
		grammarName: "tree-sitter-javascript",
		extensions: [".js", ".mjs", ".cjs"],
		getQueries: buildJavascriptQueries,
	},
	jsx: {
		grammarName: "tree-sitter-javascript",
		extensions: [".jsx"],
		getQueries: buildJavascriptQueries,
	},
};

const extensionToLanguage = new Map<string, string>();
for (const [lang, entry] of Object.entries(languageRegistry)) {
	for (const ext of entry.extensions) {
		extensionToLanguage.set(ext, lang);
	}
}

export function getLanguageForExtension(params: {
	extension: string;
}): string | null {
	return extensionToLanguage.get(params.extension) ?? null;
}

export function getLanguageEntry(params: {
	language: string;
}): LanguageEntry | null {
	return languageRegistry[params.language] ?? null;
}

export function getSupportedExtensions(): string[] {
	return Array.from(extensionToLanguage.keys());
}
