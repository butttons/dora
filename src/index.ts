#!/usr/bin/env bun

import { Command } from "commander";
import { adventure } from "./commands/adventure.ts";
import { changes } from "./commands/changes.ts";
import { classCommand } from "./commands/class.ts";
import { complexity } from "./commands/complexity.ts";
import { cookbookList, cookbookShow } from "./commands/cookbook.ts";
import { coupling } from "./commands/coupling.ts";
import { cycles } from "./commands/cycles.ts";
import { deps } from "./commands/deps.ts";
import { docsList } from "./commands/docs/list.ts";
import { docsSearch } from "./commands/docs/search.ts";
import { docsShow } from "./commands/docs/show.ts";
import { exports } from "./commands/exports.ts";
import { file } from "./commands/file.ts";
import { fn } from "./commands/fn.ts";
import { graph } from "./commands/graph.ts";
import { imports } from "./commands/imports.ts";
import { index } from "./commands/index.ts";
import { init } from "./commands/init.ts";
import { leaves } from "./commands/leaves.ts";
import { lost } from "./commands/lost.ts";
import { ls } from "./commands/ls.ts";
import { map } from "./commands/map.ts";
import { query } from "./commands/query.ts";
import { rdeps } from "./commands/rdeps.ts";
import { refs } from "./commands/refs.ts";
import { schema } from "./commands/schema.ts";
import { smells } from "./commands/smells.ts";
import { status } from "./commands/status.ts";
import { symbol } from "./commands/symbol.ts";
import { treasure } from "./commands/treasure.ts";
import { wrapCommand } from "./utils/errors.ts";
import { output } from "./utils/output.ts";

import packageJson from "../package.json";

const program = new Command();

program
	.name("dora")
	.description("Code Context CLI for AI Agents")
	.version(packageJson.version)
	.option("--json", "Output in JSON format");

program
	.command("mcp")
	.description("Start MCP (Model Context Protocol) server")
	.action(async () => {
		const { startMcpServer } = await import("./mcp.ts");
		await startMcpServer();
	});

program
	.command("init")
	.description("Initialize dora in the current repository")
	.option(
		"-l, --language <language>",
		"Project language (typescript, javascript, python, rust, go, java, scala, kotlin, dart, ruby, c, cpp, php, csharp, visualbasic)",
	)
	.action(
		wrapCommand(async (options) => {
			const result = await init({ language: options.language });
			output({ data: result, isJson: program.opts().json });
		}),
	);

program
	.command("index")
	.description("Run SCIP indexing (requires configured commands)")
	.option("--full", "Force full rebuild")
	.option("--skip-scip", "Skip running SCIP indexer (use existing .scip file)")
	.option(
		"--ignore <pattern>",
		"Ignore files matching pattern (can be repeated)",
		(value: string, previous: string[]) => previous.concat([value]),
		[],
	)
	.action(
		wrapCommand(async (options) => {
			const result = await index({
				full: options.full,
				skipScip: options.skipScip,
				ignore: options.ignore,
			});
			output({ data: result, isJson: program.opts().json });
		}),
	);

program
	.command("status")
	.description("Show index status and statistics")
	.action(
		wrapCommand(async () => {
			const result = await status();
			output({ data: result, isJson: program.opts().json });
		}),
	);

program
	.command("map")
	.description("Show high-level codebase map")
	.action(
		wrapCommand(async () => {
			const result = await map();
			output({ data: result, isJson: program.opts().json });
		}),
	);

program
	.command("ls")
	.description("List files in a directory from the index")
	.argument("[directory]", "Directory path (optional, defaults to all files)")
	.option("--limit <number>", "Maximum number of results (default: 100)")
	.option(
		"--sort <field>",
		"Sort by: path, symbols, deps, or rdeps (default: path)",
	)
	.action(
		wrapCommand(async (directory, options) => {
			const result = await ls(directory, options);
			output({ data: result, isJson: program.opts().json });
		}),
	);

program
	.command("file")
	.description("Analyze a specific file with symbols and dependencies")
	.argument("<path>", "File path to analyze")
	.action(
		wrapCommand(async (path: string) => {
			const result = await file(path);
			output({ data: result, isJson: program.opts().json });
		}),
	);

program
	.command("fn")
	.description("List all functions in a file with complexity metrics")
	.argument("<path>", "File path to analyze")
	.option(
		"--sort <metric>",
		"Sort by: complexity, loc, or name (default: complexity)",
	)
	.option(
		"--min-complexity <number>",
		"Filter functions below complexity threshold",
	)
	.option("--limit <number>", "Maximum number of results")
	.action(
		wrapCommand(async (path: string, options) => {
			const result = await fn({ path, options });
			output({ data: result, isJson: program.opts().json });
		}),
	);

program
	.command("smells")
	.description("Detect code smells in a file")
	.argument("<path>", "File path to analyze")
	.option(
		"--complexity-threshold <number>",
		"Cyclomatic complexity threshold (default: 10)",
		"10",
	)
	.option(
		"--loc-threshold <number>",
		"Lines of code threshold (default: 100)",
		"100",
	)
	.option(
		"--params-threshold <number>",
		"Parameter count threshold (default: 5)",
		"5",
	)
	.option(
		"--methods-threshold <number>",
		"Class method count threshold for god class detection (default: 20)",
		"20",
	)
	.option(
		"--properties-threshold <number>",
		"Class property count threshold for large class detection (default: 15)",
		"15",
	)
	.action(
		wrapCommand(async (path: string, options) => {
			const result = await smells({
				path,
				options: {
					complexityThreshold: parseInt(options.complexityThreshold, 10),
					locThreshold: parseInt(options.locThreshold, 10),
					paramsThreshold: parseInt(options.paramsThreshold, 10),
					methodsThreshold: parseInt(options.methodsThreshold, 10),
					propertiesThreshold: parseInt(options.propertiesThreshold, 10),
				},
			});
			output({ data: result, isJson: program.opts().json });
		}),
	);

program
	.command("class")
	.description("List all classes in a file with hierarchy and method details")
	.argument("<path>", "File path to analyze")
	.option(
		"--sort <metric>",
		"Sort by: name, methods, or complexity (default: name)",
	)
	.option("--limit <number>", "Maximum number of results")
	.action(
		wrapCommand(async (path: string, options) => {
			const result = await classCommand({ path, options });
			output({ data: result, isJson: program.opts().json });
		}),
	);

program
	.command("symbol")
	.description("Search for symbols by name")
	.argument("<query>", "Symbol name to search for")
	.option("--limit <number>", "Maximum number of results")
	.option(
		"--kind <type>",
		"Filter by symbol kind (type, class, function, interface)",
	)
	.action(
		wrapCommand(async (query, options) => {
			const result = await symbol(query, options);
			output({ data: result, isJson: program.opts().json });
		}),
	);

program
	.command("refs")
	.description("Find all references to a symbol")
	.argument("<symbol>", "Symbol name to find references for")
	.option("--kind <type>", "Filter by symbol kind")
	.option("--limit <number>", "Maximum number of results")
	.action(
		wrapCommand(async (symbol, options) => {
			const result = await refs(symbol, options);
			output({ data: result, isJson: program.opts().json });
		}),
	);

program
	.command("deps")
	.description("Show file dependencies")
	.argument("<path>", "File path to analyze")
	.option("--depth <number>", "Recursion depth (default: 1)")
	.action(
		wrapCommand(async (path, options) => {
			const result = await deps(path, options);
			output({ data: result, isJson: program.opts().json });
		}),
	);

program
	.command("rdeps")
	.description("Show reverse dependencies (what depends on this file)")
	.argument("<path>", "File path to analyze")
	.option("--depth <number>", "Recursion depth (default: 1)")
	.action(
		wrapCommand(async (path, options) => {
			const result = await rdeps(path, options);
			output({ data: result, isJson: program.opts().json });
		}),
	);

program
	.command("adventure")
	.description("Find shortest adventure between two files")
	.argument("<from>", "Source file path")
	.argument("<to>", "Target file path")
	.action(
		wrapCommand(async (from, to) => {
			const result = await adventure(from, to);
			output({ data: result, isJson: program.opts().json });
		}),
	);

program
	.command("leaves")
	.description("Find leaf nodes - files with few dependents")
	.option(
		"--max-dependents <number>",
		"Maximum number of dependents (default: 0)",
	)
	.action(
		wrapCommand(async (options) => {
			const result = await leaves(options);
			output({ data: result, isJson: program.opts().json });
		}),
	);

program
	.command("exports")
	.description("List exported symbols from a file or package")
	.argument("<target>", "File path or package name")
	.action(
		wrapCommand(async (target) => {
			const result = await exports(target);
			output({ data: result, isJson: program.opts().json });
		}),
	);

program
	.command("imports")
	.description("Show what a file imports (direct dependencies)")
	.argument("<path>", "File path to analyze")
	.action(
		wrapCommand(async (path, options) => {
			const result = await imports(path, options);
			output({ data: result, isJson: program.opts().json });
		}),
	);

program
	.command("lost")
	.description("Find lost symbols (potentially unused)")
	.option("--limit <number>", "Maximum number of results (default: 50)")
	.action(
		wrapCommand(async (options) => {
			const result = await lost(options);
			output({ data: result, isJson: program.opts().json });
		}),
	);

program
	.command("treasure")
	.description("Find treasure (most referenced files and largest dependencies)")
	.option("--limit <number>", "Maximum number of results (default: 10)")
	.action(
		wrapCommand(async (options) => {
			const result = await treasure(options);
			output({ data: result, isJson: program.opts().json });
		}),
	);

program
	.command("changes")
	.description("Show files changed since git ref and their impact")
	.argument("<ref>", "Git ref to compare against (e.g., main, HEAD~5)")
	.action(
		wrapCommand(async (ref) => {
			const result = await changes(ref);
			output({ data: result, isJson: program.opts().json });
		}),
	);

program
	.command("graph")
	.description("Generate dependency graph")
	.argument("<path>", "File path to analyze")
	.option("--depth <number>", "Graph depth (default: 1)")
	.option(
		"--direction <type>",
		"Graph direction: deps, rdeps, or both (default: both)",
	)
	.action(
		wrapCommand(async (path, options) => {
			const result = await graph(path, options);
			output({ data: result, isJson: program.opts().json });
		}),
	);

program
	.command("cycles")
	.description("Find bidirectional dependencies (A imports B, B imports A)")
	.option("--limit <number>", "Maximum number of results (default: 50)")
	.action(
		wrapCommand(async (options) => {
			const result = await cycles(options);
			output({ data: result, isJson: program.opts().json });
		}),
	);

program
	.command("coupling")
	.description("Find tightly coupled file pairs")
	.option("--threshold <number>", "Minimum total coupling score (default: 5)")
	.action(
		wrapCommand(async (options) => {
			const result = await coupling(options);
			output({ data: result, isJson: program.opts().json });
		}),
	);

program
	.command("complexity")
	.description("Show file complexity metrics")
	.option(
		"--sort <metric>",
		"Sort by: complexity, symbols, or stability (default: complexity)",
	)
	.action(
		wrapCommand(async (options) => {
			const result = await complexity(options);
			output({ data: result, isJson: program.opts().json });
		}),
	);

program
	.command("schema")
	.description("Show database schema (tables, columns, indexes)")
	.action(
		wrapCommand(async () => {
			const result = await schema();
			output({ data: result, isJson: program.opts().json });
		}),
	);

program
	.command("query")
	.description("Execute raw SQL query (read-only)")
	.argument("<sql>", "SQL query to execute")
	.action(
		wrapCommand(async (sql) => {
			const result = await query(sql);
			output({ data: result, isJson: program.opts().json });
		}),
	);

const cookbook = program
	.command("cookbook")
	.description("Query pattern cookbook and recipes");

cookbook
	.command("list")
	.description("List all available recipes")
	.option("-f, --format <format>", "Output format: json or markdown", "json")
	.action(
		wrapCommand(async (options) => {
			const result = await cookbookList(options);
			if (options.format === "markdown") {
				console.log("Available recipes:\n");
				for (const r of result.recipes) {
					console.log(`  - ${r}`);
				}
				console.log("\nView a recipe: dora cookbook show <recipe>");
				console.log("Example: dora cookbook show quickstart");
			} else {
				output({ data: result, isJson: program.opts().json });
			}
		}),
	);

cookbook
	.command("show")
	.argument(
		"[recipe]",
		"Recipe name (quickstart, methods, references, exports)",
	)
	.description("Show a recipe or index")
	.option("-f, --format <format>", "Output format: json or markdown", "json")
	.action(
		wrapCommand(async (recipe, options) => {
			const result = await cookbookShow(recipe, options);
			if (options.format === "markdown") {
				console.log(result.content);
			} else {
				output({ data: result, isJson: program.opts().json });
			}
		}),
	);

const docs = program
	.command("docs")
	.description("List, search, and view documentation files")
	.option("-t, --type <type>", "Filter by document type (md, txt)")
	.action(
		wrapCommand(async (options) => {
			const result = await docsList(options);
			output({ data: result, isJson: program.opts().json });
		}),
	);

docs
	.command("search")
	.argument("<query>", "Text to search for in documentation")
	.option("-l, --limit <number>", "Maximum number of results (default: 20)")
	.description("Search through documentation content")
	.action(
		wrapCommand(async (query, options) => {
			const result = await docsSearch(query, options);
			output({ data: result, isJson: program.opts().json });
		}),
	);

docs
	.command("show")
	.argument("<path>", "Document path")
	.option("-c, --content", "Include full document content")
	.description("Show document metadata and references")
	.action(
		wrapCommand(async (path, options) => {
			const result = await docsShow(path, options);
			output({ data: result, isJson: program.opts().json });
		}),
	);

program.parse();
