// dora index command

import { existsSync } from "fs";
import { convertToDatabase } from "../converter/convert.ts";
import { closeDb } from "../db/connection.ts";
import type { IndexResult } from "../types.ts";
import { loadConfig, saveConfig } from "../utils/config.ts";
import { CtxError } from "../utils/errors.ts";
import { outputJson } from "../utils/output.ts";
import { resolveAbsolute } from "../utils/paths.ts";
import { debugIndex } from "../utils/logger.ts";

export interface IndexOptions {
  full?: boolean; // Force full rebuild
  skipScip?: boolean; // Skip running SCIP indexer (use existing .scip file)
}

export async function index(options: IndexOptions = {}): Promise<void> {
  const startTime = Date.now();

  // Load config
  debugIndex("Loading configuration...");
  const config = await loadConfig();
  debugIndex(
    `Config loaded: root=${config.root}, scip=${config.scip}, db=${config.db}`,
  );

  const scipPath = resolveAbsolute(config.root, config.scip);
  const databasePath = resolveAbsolute(config.root, config.db);
  debugIndex(
    `Resolved paths: scipPath=${scipPath}, databasePath=${databasePath}`,
  );

  // Step 1: Run SCIP indexer command (skip if --skip-scip flag is set)
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
    // Check if .scip file exists
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

  // Verify SCIP file exists
  debugIndex("Verifying SCIP file exists...");
  if (!existsSync(scipPath)) {
    throw new CtxError(
      `SCIP file not created at ${scipPath}. Check your commands configuration.`,
    );
  }
  debugIndex("SCIP file verified");

  // Step 2: Parse SCIP file and convert to database
  debugIndex(
    `Starting conversion to database (mode: ${options.full ? "full" : "auto"})`,
  );
  const conversionStats = await convertToDatabase(
    scipPath,
    databasePath,
    config.root,
    {
      force: options.full,
    },
  );
  debugIndex(
    `Conversion completed: ${conversionStats.mode} mode, ${conversionStats.total_files} files, ${conversionStats.total_symbols} symbols`,
  );

  // Close any existing database connection
  debugIndex("Closing database connection...");
  closeDb();

  // Update config with last indexed timestamp
  debugIndex("Updating config with last indexed timestamp...");
  config.lastIndexed = new Date().toISOString();
  await saveConfig(config);

  const time_ms = Date.now() - startTime;

  const result: IndexResult = {
    success: true,
    file_count: conversionStats.total_files,
    symbol_count: conversionStats.total_symbols,
    time_ms,
    mode: conversionStats.mode,
    changed_files: conversionStats.changed_files,
  };

  debugIndex(`Indexing completed successfully in ${time_ms}ms`);
  outputJson(result);
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
