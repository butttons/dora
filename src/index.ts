#!/usr/bin/env bun

import { Command } from "commander";
import { adventure } from "./commands/adventure.ts";
import { changes } from "./commands/changes.ts";
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
import { status } from "./commands/status.ts";
import { symbol } from "./commands/symbol.ts";
import { treasure } from "./commands/treasure.ts";
import { wrapCommand } from "./utils/errors.ts";

import packageJson from "../package.json";

const program = new Command();

program
	.name("dora")
	.description("Code Context CLI for AI Agents")
	.version(packageJson.version);

program
	.command("init")
	.description("Initialize dora in the current repository")
	.action(wrapCommand(init));

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
			await index({
				full: options.full,
				skipScip: options.skipScip,
				ignore: options.ignore,
			});
		}),
	);

program
	.command("status")
	.description("Show index status and statistics")
	.action(wrapCommand(status));

program
	.command("map")
	.description("Show high-level codebase map")
	.action(wrapCommand(map));

program
	.command("ls")
	.description("List files in a directory from the index")
	.argument("[directory]", "Directory path (optional, defaults to all files)")
	.option("--limit <number>", "Maximum number of results (default: 100)")
	.option(
		"--sort <field>",
		"Sort by: path, symbols, deps, or rdeps (default: path)",
	)
	.action(wrapCommand(ls));

program
	.command("file")
	.description("Analyze a specific file with symbols and dependencies")
	.argument("<path>", "File path to analyze")
	.action(wrapCommand(file));

program
	.command("symbol")
	.description("Search for symbols by name")
	.argument("<query>", "Symbol name to search for")
	.option("--limit <number>", "Maximum number of results")
	.option(
		"--kind <type>",
		"Filter by symbol kind (type, class, function, interface)",
	)
	.action(wrapCommand(symbol));

program
	.command("refs")
	.description("Find all references to a symbol")
	.argument("<symbol>", "Symbol name to find references for")
	.option("--kind <type>", "Filter by symbol kind")
	.option("--limit <number>", "Maximum number of results")
	.action(wrapCommand(refs));

program
	.command("deps")
	.description("Show file dependencies")
	.argument("<path>", "File path to analyze")
	.option("--depth <number>", "Recursion depth (default: 1)")
	.action(wrapCommand(deps));

program
	.command("rdeps")
	.description("Show reverse dependencies (what depends on this file)")
	.argument("<path>", "File path to analyze")
	.option("--depth <number>", "Recursion depth (default: 1)")
	.action(wrapCommand(rdeps));

program
	.command("adventure")
	.description("Find shortest adventure between two files")
	.argument("<from>", "Source file path")
	.argument("<to>", "Target file path")
	.action(wrapCommand(adventure));

program
	.command("leaves")
	.description("Find leaf nodes - files with few dependents")
	.option(
		"--max-dependents <number>",
		"Maximum number of dependents (default: 0)",
	)
	.action(wrapCommand(leaves));

program
	.command("exports")
	.description("List exported symbols from a file or package")
	.argument("<target>", "File path or package name")
	.action(wrapCommand(exports));

program
	.command("imports")
	.description("Show what a file imports (direct dependencies)")
	.argument("<path>", "File path to analyze")
	.action(wrapCommand(imports));

program
	.command("lost")
	.description("Find lost symbols (potentially unused)")
	.option("--limit <number>", "Maximum number of results (default: 50)")
	.action(wrapCommand(lost));

program
	.command("treasure")
	.description("Find treasure (most referenced files and largest dependencies)")
	.option("--limit <number>", "Maximum number of results (default: 10)")
	.action(wrapCommand(treasure));

program
	.command("changes")
	.description("Show files changed since git ref and their impact")
	.argument("<ref>", "Git ref to compare against (e.g., main, HEAD~5)")
	.action(wrapCommand(changes));

program
	.command("graph")
	.description("Generate dependency graph")
	.argument("<path>", "File path to analyze")
	.option("--depth <number>", "Graph depth (default: 1)")
	.option(
		"--direction <type>",
		"Graph direction: deps, rdeps, or both (default: both)",
	)
	.action(wrapCommand(graph));

program
	.command("cycles")
	.description("Find bidirectional dependencies (A imports B, B imports A)")
	.option("--limit <number>", "Maximum number of results (default: 50)")
	.action(wrapCommand(cycles));

program
	.command("coupling")
	.description("Find tightly coupled file pairs")
	.option("--threshold <number>", "Minimum total coupling score (default: 5)")
	.action(wrapCommand(coupling));

program
	.command("complexity")
	.description("Show file complexity metrics")
	.option(
		"--sort <metric>",
		"Sort by: complexity, symbols, or stability (default: complexity)",
	)
	.action(wrapCommand(complexity));

program
	.command("schema")
	.description("Show database schema (tables, columns, indexes)")
	.action(wrapCommand(schema));

program
	.command("query")
	.description("Execute raw SQL query (read-only)")
	.argument("<sql>", "SQL query to execute")
	.action(wrapCommand(query));

const cookbook = program
	.command("cookbook")
	.description("Query pattern cookbook and recipes");

cookbook
	.command("list")
	.description("List all available recipes")
	.option("-f, --format <format>", "Output format: json or markdown", "json")
	.action(wrapCommand(cookbookList));

cookbook
	.command("show")
	.argument(
		"[recipe]",
		"Recipe name (quickstart, methods, references, exports)",
	)
	.description("Show a recipe or index")
	.option("-f, --format <format>", "Output format: json or markdown", "json")
	.action(wrapCommand(cookbookShow));

const docs = program
	.command("docs")
	.description("List, search, and view documentation files")
	.option("-t, --type <type>", "Filter by document type (md, txt)")
	.action(wrapCommand((options) => docsList(options)));

docs
	.command("search")
	.argument("<query>", "Text to search for in documentation")
	.option("-l, --limit <number>", "Maximum number of results (default: 20)")
	.description("Search through documentation content")
	.action(wrapCommand(docsSearch));

docs
	.command("show")
	.argument("<path>", "Document path")
	.option("-c, --content", "Include full document content")
	.description("Show document metadata and references")
	.action(wrapCommand(docsShow));

program.parse();
