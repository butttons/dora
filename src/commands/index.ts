import { existsSync } from "fs";
import { convertToDatabase } from "../converter/convert.ts";
import { closeDb } from "../db/connection.ts";
import type { IndexResult } from "../types.ts";
import { loadConfig, saveConfig } from "../utils/config.ts";
import { CtxError } from "../utils/errors.ts";
import { debugIndex } from "../utils/logger.ts";
import { resolveAbsolute } from "../utils/paths.ts";

export interface IndexOptions {
	full?: boolean;
	skipScip?: boolean;
	ignore?: string[];
}

export async function index(options: IndexOptions = {}): Promise<IndexResult> {
	const startTime = Date.now();

	debugIndex("Loading configuration...");
	const config = await loadConfig();
	debugIndex(
		`Config loaded: root=${config.root}, scip=${config.scip}, db=${config.db}`,
	);

	const ignorePatterns = [...(config.ignore || []), ...(options.ignore || [])];

	if (ignorePatterns.length > 0) {
		debugIndex(`Ignore patterns configured: ${ignorePatterns.join(", ")}`);
	}

	const scipPath = resolveAbsolute({
		root: config.root,
		relativePath: config.scip,
	});
	const databasePath = resolveAbsolute({
		root: config.root,
		relativePath: config.db,
	});
	debugIndex(
		`Resolved paths: scipPath=${scipPath}, databasePath=${databasePath}`,
	);

	if (options.skipScip) {
		debugIndex("Skipping SCIP indexer (--skip-scip flag set)");
	} else if (config.commands?.index) {
		debugIndex(`Running SCIP indexer: ${config.commands.index}`);
		await runCommand(config.commands.index, config.root, "Indexing");
		debugIndex("SCIP indexer completed successfully");
	} else {
		debugIndex(
			"No index command configured, checking for existing SCIP file...",
		);
		if (!existsSync(scipPath)) {
			throw new CtxError(
				`No SCIP index found at ${scipPath} and no index command configured. ` +
					`Either:\n` +
					`1. Run your SCIP indexer manually to create ${config.scip}\n` +
					`2. Configure commands.index in .dora/config.json to run your indexer automatically\n\n` +
					`Example config:\n` +
					`{\n` +
					`  "commands": {\n` +
					`    "index": "scip-typescript index --output .dora/index.scip"\n` +
					`  }\n` +
					`}`,
			);
		}
	}

	debugIndex("Verifying SCIP file exists...");
	if (!existsSync(scipPath)) {
		throw new CtxError(
			`SCIP file not created at ${scipPath}. Check your commands configuration.`,
		);
	}
	debugIndex("SCIP file verified");

	debugIndex("Closing any existing database connection...");
	closeDb();

	debugIndex(
		`Starting conversion to database (mode: ${options.full ? "full" : "auto"})`,
	);
	const conversionStats = await convertToDatabase({
		scipPath,
		databasePath,
		repoRoot: config.root,
		options: {
			force: options.full,
			ignore: ignorePatterns,
		},
	});
	debugIndex(
		`Conversion completed: ${conversionStats.mode} mode, ${conversionStats.total_files} files, ${conversionStats.total_symbols} symbols`,
	);

	debugIndex("Updating config with last indexed timestamp...");
	config.lastIndexed = new Date().toISOString();
	await saveConfig(config);

	const time_ms = Date.now() - startTime;

	debugIndex(`Indexing completed successfully in ${time_ms}ms`);

	const result: IndexResult = {
		success: true,
		file_count: conversionStats.total_files,
		symbol_count: conversionStats.total_symbols,
		time_ms,
		mode: conversionStats.mode,
		changed_files: conversionStats.changed_files,
	};

	return result;
}

/**
 * Run a shell command
 */
async function runCommand(
	command: string,
	cwd: string,
	label: string,
): Promise<void> {
	const proc = Bun.spawn(command.split(" "), {
		cwd,
		stdout: "pipe",
		stderr: "pipe",
	});

	const exitCode = await proc.exited;

	if (exitCode !== 0) {
		const stderr = await new Response(proc.stderr).text();
		throw new CtxError(`${label} failed: ${stderr || "Unknown error"}`);
	}
}
