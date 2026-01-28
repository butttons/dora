export type ToolMetadata = {
	name: string;
	description: string;
	arguments: Array<{
		name: string;
		required: boolean;
		description: string;
	}>;
	options: Array<{
		name: string;
		type: "string" | "number" | "boolean";
		description: string;
		required: boolean;
		defaultValue?: string | number | boolean;
	}>;
};

export const toolsMetadata: ToolMetadata[] = [
	{
		name: "dora_init",
		description: "Initialize dora in the current repository",
		arguments: [],
		options: [
			{
				name: "language",
				type: "string",
				description:
					"Project language (typescript, javascript, python, rust, go, java)",
				required: false,
			},
		],
	},
	{
		name: "dora_index",
		description: "Run SCIP indexing (requires configured commands)",
		arguments: [],
		options: [
			{
				name: "full",
				type: "boolean",
				description: "Force full rebuild",
				required: false,
			},
			{
				name: "skipScip",
				type: "boolean",
				description: "Skip running SCIP indexer (use existing .scip file)",
				required: false,
			},
			{
				name: "ignore",
				type: "string",
				description: "Ignore files matching pattern (can be repeated)",
				required: false,
			},
		],
	},
	{
		name: "dora_status",
		description: "Show index status and statistics",
		arguments: [],
		options: [],
	},
	{
		name: "dora_map",
		description: "Show high-level codebase map",
		arguments: [],
		options: [],
	},
	{
		name: "dora_ls",
		description: "List files in a directory from the index",
		arguments: [
			{
				name: "directory",
				required: false,
				description: "Directory path (optional, defaults to all files)",
			},
		],
		options: [
			{
				name: "limit",
				type: "number",
				description: "Maximum number of results (default: 100)",
				required: false,
			},
			{
				name: "sort",
				type: "string",
				description: "Sort by: path, symbols, deps, or rdeps (default: path)",
				required: false,
			},
		],
	},
	{
		name: "dora_file",
		description: "Analyze a specific file with symbols and dependencies",
		arguments: [
			{
				name: "path",
				required: true,
				description: "File path to analyze",
			},
		],
		options: [],
	},
	{
		name: "dora_symbol",
		description: "Search for symbols by name",
		arguments: [
			{
				name: "query",
				required: true,
				description: "Symbol name to search for",
			},
		],
		options: [
			{
				name: "limit",
				type: "number",
				description: "Maximum number of results",
				required: false,
			},
			{
				name: "kind",
				type: "string",
				description:
					"Filter by symbol kind (type, class, function, interface)",
				required: false,
			},
		],
	},
	{
		name: "dora_refs",
		description: "Find all references to a symbol",
		arguments: [
			{
				name: "symbol",
				required: true,
				description: "Symbol name to find references for",
			},
		],
		options: [
			{
				name: "kind",
				type: "string",
				description: "Filter by symbol kind",
				required: false,
			},
			{
				name: "limit",
				type: "number",
				description: "Maximum number of results",
				required: false,
			},
		],
	},
	{
		name: "dora_deps",
		description: "Show file dependencies",
		arguments: [
			{
				name: "path",
				required: true,
				description: "File path to analyze",
			},
		],
		options: [
			{
				name: "depth",
				type: "number",
				description: "Recursion depth (default: 1)",
				required: false,
			},
		],
	},
	{
		name: "dora_rdeps",
		description: "Show reverse dependencies (what depends on this file)",
		arguments: [
			{
				name: "path",
				required: true,
				description: "File path to analyze",
			},
		],
		options: [
			{
				name: "depth",
				type: "number",
				description: "Recursion depth (default: 1)",
				required: false,
			},
		],
	},
	{
		name: "dora_adventure",
		description: "Find shortest adventure between two files",
		arguments: [
			{
				name: "from",
				required: true,
				description: "Source file path",
			},
			{
				name: "to",
				required: true,
				description: "Target file path",
			},
		],
		options: [],
	},
	{
		name: "dora_leaves",
		description: "Find leaf nodes - files with few dependents",
		arguments: [],
		options: [
			{
				name: "maxDependents",
				type: "number",
				description: "Maximum number of dependents (default: 0)",
				required: false,
			},
		],
	},
	{
		name: "dora_exports",
		description: "List exported symbols from a file or package",
		arguments: [
			{
				name: "target",
				required: true,
				description: "File path or package name",
			},
		],
		options: [],
	},
	{
		name: "dora_imports",
		description: "Show what a file imports (direct dependencies)",
		arguments: [
			{
				name: "path",
				required: true,
				description: "File path to analyze",
			},
		],
		options: [],
	},
	{
		name: "dora_lost",
		description: "Find lost symbols (potentially unused)",
		arguments: [],
		options: [
			{
				name: "limit",
				type: "number",
				description: "Maximum number of results (default: 50)",
				required: false,
			},
		],
	},
	{
		name: "dora_treasure",
		description:
			"Find treasure (most referenced files and largest dependencies)",
		arguments: [],
		options: [
			{
				name: "limit",
				type: "number",
				description: "Maximum number of results (default: 10)",
				required: false,
			},
		],
	},
	{
		name: "dora_changes",
		description: "Show files changed since git ref and their impact",
		arguments: [
			{
				name: "ref",
				required: true,
				description: "Git ref to compare against (e.g., main, HEAD~5)",
			},
		],
		options: [],
	},
	{
		name: "dora_graph",
		description: "Generate dependency graph",
		arguments: [
			{
				name: "path",
				required: true,
				description: "File path to analyze",
			},
		],
		options: [
			{
				name: "depth",
				type: "number",
				description: "Graph depth (default: 1)",
				required: false,
			},
			{
				name: "direction",
				type: "string",
				description: "Graph direction: deps, rdeps, or both (default: both)",
				required: false,
			},
		],
	},
	{
		name: "dora_cycles",
		description:
			"Find bidirectional dependencies (A imports B, B imports A)",
		arguments: [],
		options: [
			{
				name: "limit",
				type: "number",
				description: "Maximum number of results (default: 50)",
				required: false,
			},
		],
	},
	{
		name: "dora_coupling",
		description: "Find tightly coupled file pairs",
		arguments: [],
		options: [
			{
				name: "threshold",
				type: "number",
				description: "Minimum total coupling score (default: 5)",
				required: false,
			},
		],
	},
	{
		name: "dora_complexity",
		description: "Show file complexity metrics",
		arguments: [],
		options: [
			{
				name: "sort",
				type: "string",
				description:
					"Sort by: complexity, symbols, or stability (default: complexity)",
				required: false,
			},
		],
	},
	{
		name: "dora_schema",
		description: "Show database schema (tables, columns, indexes)",
		arguments: [],
		options: [],
	},
	{
		name: "dora_query",
		description: "Execute raw SQL query (read-only)",
		arguments: [
			{
				name: "sql",
				required: true,
				description: "SQL query to execute",
			},
		],
		options: [],
	},
	{
		name: "dora_cookbook_list",
		description: "List all available recipes",
		arguments: [],
		options: [
			{
				name: "format",
				type: "string",
				description: "Output format: json or markdown",
				required: false,
				defaultValue: "json",
			},
		],
	},
	{
		name: "dora_cookbook_show",
		description: "Show a recipe or index",
		arguments: [
			{
				name: "recipe",
				required: false,
				description:
					"Recipe name (quickstart, methods, references, exports)",
			},
		],
		options: [
			{
				name: "format",
				type: "string",
				description: "Output format: json or markdown",
				required: false,
				defaultValue: "json",
			},
		],
	},
	{
		name: "dora_docs_list",
		description: "List all indexed documentation files",
		arguments: [],
		options: [
			{
				name: "type",
				type: "string",
				description: "Filter by document type (md, txt)",
				required: false,
			},
		],
	},
	{
		name: "dora_docs_search",
		description: "Search through documentation content",
		arguments: [
			{
				name: "query",
				required: true,
				description: "Text to search for in documentation",
			},
		],
		options: [
			{
				name: "limit",
				type: "number",
				description: "Maximum number of results (default: 20)",
				required: false,
			},
		],
	},
	{
		name: "dora_docs_show",
		description: "Show document metadata and references",
		arguments: [
			{
				name: "path",
				required: true,
				description: "Document path",
			},
		],
		options: [
			{
				name: "content",
				type: "boolean",
				description: "Include full document content",
				required: false,
			},
		],
	},
];
