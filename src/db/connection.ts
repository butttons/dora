// Database connection management

import { Database } from "bun:sqlite";
import { existsSync } from "fs";
import type { Config } from "../utils/config.ts";
import { CtxError } from "../utils/errors.ts";
import { resolveAbsolute } from "../utils/paths.ts";

let dbInstance: Database | null = null;
let currentDbPath: string | null = null;

/**
 * Get database connection (singleton pattern)
 * Always uses the dora database
 */
export function getDb(config: Config): Database {
  const dbPath = resolveAbsolute(config.root, config.db);

  // Check if database exists
  if (!existsSync(dbPath)) {
    throw new CtxError(
      `Database not found at ${dbPath}. Run 'dora index' to create the index.`,
    );
  }

  // Return existing connection if same database
  if (dbInstance && currentDbPath === dbPath) {
    return dbInstance;
  }

  // Close old connection if switching databases
  if (dbInstance) {
    dbInstance.close();
  }

  // Open new connection in readonly mode
  try {
    dbInstance = new Database(dbPath, { readonly: true });
    currentDbPath = dbPath;
    return dbInstance;
  } catch (error) {
    throw new CtxError(
      `Failed to open database: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Close database connection
 */
export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    currentDbPath = null;
  }
}
