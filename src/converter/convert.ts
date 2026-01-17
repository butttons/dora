import { Database } from "bun:sqlite";
import { existsSync } from "fs";
import path from "path";
import {
  extractNameFromScip,
  extractPackageFromScip,
  symbolKindToString,
  extractKindFromDocumentation,
} from "./helpers";
import {
  parseScipFile,
  buildLookupMaps,
  extractDefinitions,
  extractReferences,
  getFileDependencies,
  type ParsedDocument,
  type ParsedSymbol,
  type ScipData,
} from "./scip-parser";
import { debugConverter } from "../utils/logger.ts";

// Batch size for processing documents to avoid memory exhaustion
const BATCH_SIZE = 500;

// Inlined schema for standalone binary compilation
const SCHEMA_SQL = `-- database schema for dora CLI
-- Optimized for read performance with denormalized data

-- Files table with change tracking
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT UNIQUE NOT NULL,
  language TEXT,
  mtime INTEGER NOT NULL,
  symbol_count INTEGER DEFAULT 0,
  indexed_at INTEGER NOT NULL,
  dependency_count INTEGER DEFAULT 0,
  dependent_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
CREATE INDEX IF NOT EXISTS idx_files_mtime ON files(mtime);

-- Symbols table with flattened location data
CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  scip_symbol TEXT,
  kind TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  start_char INTEGER NOT NULL,
  end_char INTEGER NOT NULL,
  documentation TEXT,
  package TEXT,
  is_local BOOLEAN DEFAULT 0,
  reference_count INTEGER DEFAULT 0,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_file_id ON symbols(file_id);
CREATE INDEX IF NOT EXISTS idx_symbols_package ON symbols(package);
CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);
CREATE INDEX IF NOT EXISTS idx_symbols_is_local ON symbols(is_local);

-- Pre-computed dependencies table
CREATE TABLE IF NOT EXISTS dependencies (
  from_file_id INTEGER NOT NULL,
  to_file_id INTEGER NOT NULL,
  symbol_count INTEGER DEFAULT 1,
  symbols TEXT,
  PRIMARY KEY (from_file_id, to_file_id),
  FOREIGN KEY (from_file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (to_file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_deps_from ON dependencies(from_file_id);
CREATE INDEX IF NOT EXISTS idx_deps_to ON dependencies(to_file_id);

-- Symbol references table (tracks where symbols are used)
CREATE TABLE IF NOT EXISTS symbol_references (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL,
  line INTEGER NOT NULL,
  FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refs_symbol ON symbol_references(symbol_id);
CREATE INDEX IF NOT EXISTS idx_refs_file ON symbol_references(file_id);
CREATE INDEX IF NOT EXISTS idx_refs_line ON symbol_references(symbol_id, file_id, line);

-- Packages table
CREATE TABLE IF NOT EXISTS packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  manager TEXT NOT NULL,
  version TEXT,
  symbol_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_packages_name ON packages(name);

-- Metadata table for system info
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);`;

export interface ConversionOptions {
  force?: boolean; // Force full rebuild
}

export interface ConversionStats {
  mode: "full" | "incremental";
  total_files: number;
  total_symbols: number;
  changed_files: number;
  deleted_files: number;
  time_ms: number;
}

interface ChangedFile {
  path: string;
  mtime: number;
}

/**
 * Helper function to chunk an array into smaller batches
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Converts a SCIP protobuf index file to an optimized SQLite database.
 *
 * Uses batch processing to handle large codebases efficiently and supports
 * incremental indexing by comparing file modification times.
 *
 * @param scipPath - Absolute path to the .scip protobuf file
 * @param databasePath - Absolute path where the SQLite database will be created/updated
 * @param repoRoot - Absolute path to the repository root (for resolving relative file paths)
 * @param options - Conversion options (force: boolean to force full rebuild)
 * @returns Conversion statistics including mode (full/incremental), file counts, and timing
 * @throws {Error} If SCIP file cannot be parsed or database cannot be created
 */
export async function convertToDatabase(
  scipPath: string,
  databasePath: string,
  repoRoot: string,
  options: ConversionOptions = {},
): Promise<ConversionStats> {
  const startTime = Date.now();

  // Parse SCIP protobuf file
  debugConverter(`Parsing SCIP file at ${scipPath}...`);
  let scipData: ScipData;
  try {
    scipData = await parseScipFile(scipPath);
    debugConverter(`Parsed SCIP file: ${scipData.documents.length} documents`);
  } catch (error) {
    throw new Error(`Failed to parse SCIP file at ${scipPath}: ${error}`);
  }

  // Open database
  debugConverter(`Opening database at ${databasePath}...`);
  let db: Database;
  try {
    db = new Database(databasePath, { create: true });
    debugConverter("Database opened successfully");
  } catch (error) {
    throw new Error(
      `Failed to open/create database at ${databasePath}: ${error}`,
    );
  }

  // Initialize schema
  debugConverter("Initializing database schema...");
  initializeSchema(db);
  debugConverter("Schema initialized");

  // Optimize database for bulk writes
  optimizeDatabaseForWrites(db);

  // Determine if this is a full or incremental build
  const isFirstRun = !hasExistingData(db);
  const isForceFull = options.force === true;
  const mode = isFirstRun || isForceFull ? "full" : "incremental";
  debugConverter(
    `Build mode: ${mode} (firstRun=${isFirstRun}, force=${isForceFull})`,
  );

  // Build a quick document lookup (lightweight - just paths)
  const documentsByPath = new Map(
    scipData.documents.map((doc) => [doc.relativePath, doc]),
  );

  let changedFiles: ChangedFile[];
  let deletedFiles: string[];

  if (mode === "full") {
    // Full rebuild: get all files from SCIP data
    debugConverter("Getting all files for full rebuild...");
    changedFiles = await getAllFiles(documentsByPath, repoRoot);
    deletedFiles = [];
    debugConverter(`Full rebuild: processing ${changedFiles.length} files`);

    // Clear existing data
    debugConverter("Clearing existing database data...");
    clearAllData(db);
    debugConverter("Existing data cleared");
  } else {
    // Incremental: detect changes via filesystem scan
    debugConverter("Detecting changed and deleted files...");
    const changes = await detectChangedFiles(documentsByPath, db, repoRoot);
    changedFiles = changes.changed;
    deletedFiles = changes.deleted;
    debugConverter(
      `Incremental build: ${changedFiles.length} changed, ${deletedFiles.length} deleted`,
    );
  }

  // Delete old data
  if (deletedFiles.length > 0) {
    debugConverter(
      `Deleting ${deletedFiles.length} old files from database...`,
    );
    deleteOldData(db, deletedFiles, []);
    debugConverter(`Deleted ${deletedFiles.length} files from database`);
  }

  if (changedFiles.length > 0) {
    // Delete old versions of changed files
    debugConverter(
      `Removing old versions of ${changedFiles.length} changed files...`,
    );
    deleteOldData(db, [], changedFiles);

    // Process files in batches to avoid memory exhaustion
    await processBatches(db, scipData, changedFiles, repoRoot);
  }

  // Restore database settings
  restoreDatabaseSettings(db);

  // Update packages (skip if no files changed)
  debugConverter("Updating packages table...");
  updatePackages(db, changedFiles.length === 0 && deletedFiles.length === 0);
  debugConverter("Packages table updated");

  // Update denormalized fields
  debugConverter("Updating denormalized fields...");
  updateDenormalizedFields(db);
  debugConverter("Denormalized fields updated");

  // Update metadata and get stats
  debugConverter("Updating metadata...");
  const stats = updateMetadata(
    db,
    mode,
    changedFiles.length,
    deletedFiles.length,
  );
  debugConverter(
    `Metadata updated: ${stats.total_files} total files, ${stats.total_symbols} total symbols`,
  );

  // Close database
  debugConverter("Closing database...");
  db.close();

  const timeMs = Date.now() - startTime;

  return {
    ...stats,
    time_ms: timeMs,
  };
}

/**
 * Process files in batches to avoid memory exhaustion
 */
async function processBatches(
  db: Database,
  scipData: ScipData,
  changedFiles: ChangedFile[],
  repoRoot: string,
): Promise<void> {
  const timestamp = Math.floor(Date.now() / 1000);

  // Create a set of changed paths for quick lookup
  const changedPathsSet = new Set(changedFiles.map((f) => f.path));

  // Filter scipData documents to only include changed files
  const docsToProcess = scipData.documents.filter((doc) =>
    changedPathsSet.has(doc.relativePath),
  );

  debugConverter(
    `Processing ${docsToProcess.length} documents in batches of ${BATCH_SIZE}...`,
  );

  // Build LIGHTWEIGHT global definition map (only symbol -> file path)
  debugConverter("Building lightweight global definition map...");
  const globalDefinitionsBySymbol = new Map<
    string,
    { file: string; definition: any }
  >();
  const externalSymbols = scipData.externalSymbols;

  // Process documents in chunks to build definition map without keeping all in memory
  for (const doc of scipData.documents) {
    // Extract only the symbol IDs and file path (very lightweight)
    for (const occ of doc.occurrences) {
      if (occ.symbolRoles & 0x1) {
        // Definition bit
        // Store minimal info - we'll get full details from documentsByPath later
        if (!globalDefinitionsBySymbol.has(occ.symbol)) {
          globalDefinitionsBySymbol.set(occ.symbol, {
            file: doc.relativePath,
            definition: { symbol: occ.symbol, range: occ.range },
          });
        }
      }
    }
  }
  debugConverter(
    `Global definition map built: ${globalDefinitionsBySymbol.size} definitions`,
  );

  // Build LIGHTWEIGHT global symbols map (only external symbols + doc symbols, no duplication)
  debugConverter("Building global symbols map...");
  const globalSymbolsById = new Map<string, ParsedSymbol>();

  // Add external symbols first (these are small, usually < 10K)
  for (const sym of externalSymbols) {
    globalSymbolsById.set(sym.symbol, sym);
  }

  // Add document symbols efficiently (no deep copies)
  for (const doc of scipData.documents) {
    for (const sym of doc.symbols) {
      if (!globalSymbolsById.has(sym.symbol)) {
        globalSymbolsById.set(sym.symbol, sym);
      }
    }
  }
  debugConverter(`Global symbols map built: ${globalSymbolsById.size} symbols`);

  // Chunk documents into batches
  const batches = chunkArray(docsToProcess, BATCH_SIZE);

  // Clear scipData external symbols reference (we copied it)
  scipData.externalSymbols = [];
  debugConverter("Cleared scipData external symbols");

  const totalBatches = batches.length;
  let processedFiles = 0;
  const totalFiles = docsToProcess.length;
  const progressStartTime = Date.now();

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const batchNum = batchIndex + 1;

    // Calculate progress
    const percent = Math.floor((processedFiles / totalFiles) * 100);
    const elapsed = (Date.now() - progressStartTime) / 1000;
    const rate = processedFiles / elapsed || 0;
    const remaining = totalFiles - processedFiles;
    const eta = rate > 0 ? Math.ceil(remaining / rate) : 0;

    process.stderr.write(
      `\rIndexing: ${percent}% (${processedFiles}/${totalFiles} files, batch ${batchNum}/${totalBatches}, ETA: ${eta}s)      `,
    );

    // Build lightweight document map for this batch
    const documentsByPath = new Map(
      batch.map((doc) => [doc.relativePath, doc]),
    );

    // Get ChangedFile objects for this batch
    const batchChangedFiles = changedFiles.filter((f) =>
      batch.some((doc) => doc.relativePath === f.path),
    );

    // Convert files in this batch
    await convertFiles(
      documentsByPath,
      globalSymbolsById,
      db,
      batchChangedFiles,
      timestamp,
    );

    // Update dependencies for this batch (uses global maps for cross-batch deps)
    await updateDependencies(
      documentsByPath,
      globalSymbolsById,
      globalDefinitionsBySymbol,
      db,
      batchChangedFiles,
    );

    // Update symbol references for this batch
    await updateSymbolReferences(
      documentsByPath,
      globalSymbolsById,
      db,
      batchChangedFiles,
    );

    processedFiles += batch.length;
  }

  process.stderr.write("\n");
  debugConverter(
    `Batch processing complete: ${processedFiles} files processed`,
  );
}

/**
 * Initialize database schema
 */
function initializeSchema(db: Database): void {
  // Check if schema already exists (quick optimization)
  try {
    const tableCheck = db
      .query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='files'",
      )
      .get();

    if (tableCheck) {
      // Schema exists, skip initialization
      return;
    }
  } catch {
    // Continue with initialization
  }

  // Execute schema (multiple statements)
  const statements = SCHEMA_SQL.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    db.run(stmt);
  }
}

/**
 * Optimize database for bulk writes
 */
function optimizeDatabaseForWrites(db: Database): void {
  debugConverter("Optimizing database for bulk writes...");

  // Disable synchronous writes (much faster, but less crash-safe during indexing)
  db.run("PRAGMA synchronous = OFF");

  // Use memory for journal (faster than disk)
  db.run("PRAGMA journal_mode = MEMORY");

  // Increase cache size (10MB)
  db.run("PRAGMA cache_size = -10000");

  debugConverter("Database optimizations applied");
}

/**
 * Restore normal database settings after bulk writes
 */
function restoreDatabaseSettings(db: Database): void {
  debugConverter("Restoring normal database settings...");

  // Re-enable synchronous writes
  db.run("PRAGMA synchronous = FULL");

  // Switch back to WAL mode
  db.run("PRAGMA journal_mode = WAL");

  debugConverter("Database settings restored");
}

/**
 * Check if database has existing data
 */
function hasExistingData(db: Database): boolean {
  try {
    const result = db.query("SELECT COUNT(*) as count FROM files").get() as {
      count: number;
    };
    return result.count > 0;
  } catch {
    return false;
  }
}

/**
 * Clear all data from database (for full rebuild)
 */
function clearAllData(db: Database): void {
  db.run("BEGIN TRANSACTION");
  db.run("DELETE FROM symbol_references");
  db.run("DELETE FROM dependencies");
  db.run("DELETE FROM symbols");
  db.run("DELETE FROM files");
  db.run("DELETE FROM packages");
  db.run("DELETE FROM metadata");
  db.run("COMMIT");
}

/**
 * Get all files from SCIP data (for full rebuild)
 */
async function getAllFiles(
  documentsByPath: Map<string, ParsedDocument>,
  repoRoot: string,
): Promise<ChangedFile[]> {
  const files: ChangedFile[] = [];

  for (const [relativePath, doc] of documentsByPath) {
    const fullPath = path.join(repoRoot, relativePath);
    try {
      const stat = await Bun.file(fullPath).stat();
      const mtime = Math.floor(stat.mtime.getTime() / 1000);
      files.push({ path: relativePath, mtime });
    } catch {}
  }

  return files;
}

/**
 * Detect changed and deleted files (for incremental rebuild)
 */
async function detectChangedFiles(
  documentsByPath: Map<string, ParsedDocument>,
  db: Database,
  repoRoot: string,
): Promise<{ changed: ChangedFile[]; deleted: string[] }> {
  // Get existing files from database with mtime
  const existingFiles = new Map(
    (
      db.query("SELECT path, mtime FROM files").all() as Array<{
        path: string;
        mtime: number;
      }>
    ).map((f) => [f.path, f.mtime]),
  );

  const changed: ChangedFile[] = [];
  const deleted = new Set(existingFiles.keys());

  for (const [relativePath, doc] of documentsByPath) {
    deleted.delete(relativePath);

    // Get current mtime from filesystem
    const fullPath = path.join(repoRoot, relativePath);
    try {
      const stat = await Bun.file(fullPath).stat();
      const currentMtime = Math.floor(stat.mtime.getTime() / 1000);

      const existingMtime = existingFiles.get(relativePath);

      // File is new or modified
      if (!existingMtime || currentMtime > existingMtime) {
        changed.push({ path: relativePath, mtime: currentMtime });
      }
    } catch {}
  }

  return { changed, deleted: Array.from(deleted) };
}

/**
 * Delete old data for deleted or changed files
 */
function deleteOldData(
  db: Database,
  deletedFiles: string[],
  changedFiles: ChangedFile[],
): void {
  const allFilesToRemove = [
    ...deletedFiles,
    ...changedFiles.map((f) => f.path),
  ];

  if (allFilesToRemove.length === 0) return;

  db.run("BEGIN TRANSACTION");

  const stmt = db.prepare("DELETE FROM files WHERE path = ?");
  for (const filePath of allFilesToRemove) {
    stmt.run(filePath);
  }

  db.run("COMMIT");
}

/**
 * Convert changed files from SCIP data to database
 */
async function convertFiles(
  documentsByPath: Map<string, ParsedDocument>,
  symbolsById: Map<string, ParsedSymbol>,
  db: Database,
  changedFiles: ChangedFile[],
  timestamp: number,
): Promise<void> {
  if (changedFiles.length === 0) return;

  debugConverter("Starting database transaction for file conversion...");
  db.run("BEGIN TRANSACTION");

  const fileStmt = db.prepare(
    "INSERT INTO files (path, language, mtime, indexed_at) VALUES (?, ?, ?, ?)",
  );

  const symbolStmt = db.prepare(`
    INSERT INTO symbols (
      file_id, name, scip_symbol, kind,
      start_line, end_line, start_char, end_char,
      documentation, package, is_local
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let processedCount = 0;
  const logInterval = Math.max(1, Math.floor(changedFiles.length / 10)); // Log every 10%

  for (const { path: filePath, mtime } of changedFiles) {
    processedCount++;

    if (
      processedCount % logInterval === 0 ||
      processedCount === changedFiles.length
    ) {
      debugConverter(
        `Converting files: ${processedCount}/${changedFiles.length} (${Math.floor((processedCount / changedFiles.length) * 100)}%)`,
      );
    }
    // Get document from parsed SCIP data
    const doc = documentsByPath.get(filePath);
    if (!doc) continue;

    // Insert file
    fileStmt.run(filePath, doc.language, mtime, timestamp);

    // Get file_id from database
    const fileRecord = db
      .query("SELECT id FROM files WHERE path = ?")
      .get(filePath) as { id: number } | undefined;

    if (!fileRecord) continue;

    const fileId = fileRecord.id;

    // Extract symbol definitions from occurrences
    const definitions = extractDefinitions(doc);

    // Insert symbols (batch)
    for (const def of definitions) {
      const symbolInfo = symbolsById.get(def.symbol);

      // Get symbol metadata
      let kind = symbolKindToString(symbolInfo?.kind ?? 0);

      // Fallback: If kind is unknown, try to extract from documentation
      if (kind === "unknown" && symbolInfo?.documentation) {
        kind = extractKindFromDocumentation(symbolInfo.documentation);
      }

      const pkg = extractPackageFromScip(def.symbol);
      const name = symbolInfo?.displayName || extractNameFromScip(def.symbol);
      const documentation = symbolInfo?.documentation?.join("\n");

      // Detect if symbol is local (function parameters, closure variables, etc.)
      const isLocal = def.symbol.includes("local") ? 1 : 0;

      symbolStmt.run(
        fileId,
        name,
        def.symbol,
        kind,
        def.range[0], // start_line
        def.range[2], // end_line
        def.range[1], // start_char
        def.range[3], // end_char
        documentation || null,
        pkg,
        isLocal,
      );
    }
  }

  debugConverter(`Committing transaction for ${changedFiles.length} files...`);
  db.run("COMMIT");
  debugConverter("Transaction committed successfully");
}

/**
 * Update dependencies for changed files
 */
async function updateDependencies(
  documentsByPath: Map<string, ParsedDocument>,
  symbolsById: Map<string, ParsedSymbol>,
  definitionsBySymbol: Map<string, { file: string; definition: any }>,
  db: Database,
  changedFiles: ChangedFile[],
): Promise<void> {
  if (changedFiles.length === 0) return;

  const changedPaths = changedFiles.map((f) => f.path);
  debugConverter(
    `Finding affected files for ${changedPaths.length} changed files...`,
  );

  // Get affected files (changed + their dependents)
  const affectedFiles = new Set(changedPaths);

  // Find files that import changed files
  if (changedPaths.length > 0) {
    const placeholders = changedPaths.map(() => "?").join(",");
    const dependents = db
      .query(
        `
      SELECT DISTINCT f.path
      FROM dependencies d
      JOIN files f ON f.id = d.from_file_id
      JOIN files f2 ON f2.id = d.to_file_id
      WHERE f2.path IN (${placeholders})
    `,
      )
      .all(...changedPaths) as Array<{ path: string }>;

    for (const { path } of dependents) {
      affectedFiles.add(path);
    }
    debugConverter(
      `Found ${dependents.length} dependent files, total affected: ${affectedFiles.size}`,
    );
  }

  // Delete old dependencies for affected files
  debugConverter("Starting transaction for dependencies update...");
  db.run("BEGIN TRANSACTION");

  const deleteStmt = db.prepare(`
    DELETE FROM dependencies
    WHERE from_file_id IN (SELECT id FROM files WHERE path = ?)
  `);

  for (const filePath of affectedFiles) {
    deleteStmt.run(filePath);
  }
  debugConverter(`Deleted old dependencies for ${affectedFiles.size} files`);

  // Recompute dependencies from SCIP data
  debugConverter(`Recomputing dependencies for ${affectedFiles.size} files...`);
  const insertStmt = db.prepare(`
    INSERT INTO dependencies (from_file_id, to_file_id, symbol_count, symbols)
    VALUES (?, ?, ?, ?)
  `);

  let processedCount = 0;
  const logInterval = Math.max(1, Math.floor(affectedFiles.size / 10));

  for (const fromPath of affectedFiles) {
    processedCount++;

    if (
      processedCount % logInterval === 0 ||
      processedCount === affectedFiles.size
    ) {
      debugConverter(
        `Processing dependencies: ${processedCount}/${affectedFiles.size} (${Math.floor((processedCount / affectedFiles.size) * 100)}%)`,
      );
    }
    const doc = documentsByPath.get(fromPath);
    if (!doc) continue;

    // Get file dependencies
    const depsByFile = getFileDependencies(
      doc,
      documentsByPath,
      symbolsById,
      definitionsBySymbol,
    );

    const fromFileRecord = db
      .query("SELECT id FROM files WHERE path = ?")
      .get(fromPath) as { id: number } | undefined;

    if (!fromFileRecord) continue;

    const fromFileId = fromFileRecord.id;

    for (const [toPath, symbols] of depsByFile) {
      const toFileRecord = db
        .query("SELECT id FROM files WHERE path = ?")
        .get(toPath) as { id: number } | undefined;

      if (!toFileRecord) continue;

      // Extract symbol names
      const symbolNames = Array.from(
        new Set(
          Array.from(symbols)
            .filter((scipSymbol) => !scipSymbol.includes("local")) // Filter out local symbols
            .map((scipSymbol) => {
              const symbolInfo = symbolsById.get(scipSymbol);
              return symbolInfo?.displayName || extractNameFromScip(scipSymbol);
            })
            .filter((name) => name && name !== "unknown"),
        ),
      );

      if (symbolNames.length === 0) continue;

      insertStmt.run(
        fromFileId,
        toFileRecord.id,
        symbolNames.length,
        JSON.stringify(symbolNames),
      );
    }
  }

  debugConverter("Committing dependencies transaction...");
  db.run("COMMIT");
  debugConverter("Dependencies transaction committed");
}

/**
 * Update symbol references for changed files
 */
async function updateSymbolReferences(
  documentsByPath: Map<string, ParsedDocument>,
  symbolsById: Map<string, ParsedSymbol>,
  db: Database,
  changedFiles: ChangedFile[],
): Promise<void> {
  if (changedFiles.length === 0) return;

  const affectedFiles = changedFiles.map((f) => f.path);
  debugConverter(
    `Updating symbol references for ${affectedFiles.length} files...`,
  );

  db.run("BEGIN TRANSACTION");

  // Delete old references from changed files
  const deleteStmt = db.prepare(`
    DELETE FROM symbol_references
    WHERE file_id IN (SELECT id FROM files WHERE path = ?)
  `);

  for (const filePath of affectedFiles) {
    deleteStmt.run(filePath);
  }
  debugConverter(`Deleted old references for ${affectedFiles.length} files`);

  // Build symbol lookup map (scip_symbol -> id) for fast lookups
  debugConverter("Building symbol ID lookup map...");
  const symbolIdMap = new Map<string, number>();
  const allSymbols = db
    .query("SELECT id, scip_symbol FROM symbols")
    .all() as Array<{
    id: number;
    scip_symbol: string;
  }>;
  for (const sym of allSymbols) {
    symbolIdMap.set(sym.scip_symbol, sym.id);
  }
  debugConverter(`Symbol lookup map built: ${symbolIdMap.size} symbols`);

  // Build file ID lookup map for fast lookups
  debugConverter("Building file ID lookup map...");
  const fileIdMap = new Map<string, number>();
  for (const filePath of affectedFiles) {
    const fileRecord = db
      .query("SELECT id FROM files WHERE path = ?")
      .get(filePath) as { id: number } | undefined;
    if (fileRecord) {
      fileIdMap.set(filePath, fileRecord.id);
    }
  }
  debugConverter(`File lookup map built: ${fileIdMap.size} files`);

  // Insert new references from changed files
  const insertStmt = db.prepare(`
    INSERT INTO symbol_references (symbol_id, file_id, line)
    VALUES (?, ?, ?)
  `);

  let processedCount = 0;
  let totalReferences = 0;
  const logInterval = Math.max(1, Math.floor(affectedFiles.length / 10));

  for (const fromPath of affectedFiles) {
    processedCount++;

    if (
      processedCount % logInterval === 0 ||
      processedCount === affectedFiles.length
    ) {
      debugConverter(
        `Processing references: ${processedCount}/${affectedFiles.length} (${Math.floor((processedCount / affectedFiles.length) * 100)}%) - ${totalReferences} refs inserted`,
      );
    }

    const doc = documentsByPath.get(fromPath);
    if (!doc) continue;

    const fromFileId = fileIdMap.get(fromPath);
    if (!fromFileId) continue;

    // Extract references from occurrences
    const references = extractReferences(doc);

    // For each reference, look up symbol ID from map
    for (const ref of references) {
      // Skip local symbols
      if (ref.symbol.includes("local")) continue;

      const symbolId = symbolIdMap.get(ref.symbol);
      if (!symbolId) continue;

      insertStmt.run(symbolId, fromFileId, ref.line);
      totalReferences++;
    }
  }

  debugConverter(`Total references inserted: ${totalReferences}`);

  debugConverter("Committing symbol references transaction...");
  db.run("COMMIT");
  debugConverter("Symbol references transaction committed");
}

/**
 * Update denormalized fields for performance
 */
function updateDenormalizedFields(db: Database): void {
  // Update file symbol counts
  debugConverter("Computing file symbol counts...");
  db.run(`
    UPDATE files
    SET symbol_count = (
      SELECT COUNT(*)
      FROM symbols s
      WHERE s.file_id = files.id
    )
  `);
  debugConverter("File symbol counts updated");

  // Update symbol reference counts
  debugConverter("Computing symbol reference counts...");
  db.run(`
    UPDATE symbols
    SET reference_count = (
      SELECT COUNT(*)
      FROM symbol_references sr
      WHERE sr.symbol_id = symbols.id
    )
  `);
  debugConverter("Symbol reference counts updated");

  // Update file dependency counts (outgoing dependencies)
  debugConverter("Computing file dependency counts...");
  db.run(`
    UPDATE files
    SET dependency_count = (
      SELECT COUNT(DISTINCT to_file_id)
      FROM dependencies d
      WHERE d.from_file_id = files.id
    )
  `);
  debugConverter("File dependency counts updated");

  // Update file dependent counts (incoming dependencies / fan-in)
  debugConverter("Computing file dependent counts...");
  db.run(`
    UPDATE files
    SET dependent_count = (
      SELECT COUNT(DISTINCT from_file_id)
      FROM dependencies d
      WHERE d.to_file_id = files.id
    )
  `);
  debugConverter("File dependent counts updated");
}

/**
 * Update packages table
 */
function updatePackages(db: Database, skipIfNoChanges: boolean = false): void {
  if (skipIfNoChanges) {
    // Check if packages table needs update
    const packageCount = (
      db.query("SELECT COUNT(*) as c FROM packages").get() as {
        c: number;
      }
    ).c;
    const symbolPackageCount = (
      db
        .query(
          "SELECT COUNT(DISTINCT package) as c FROM symbols WHERE package IS NOT NULL",
        )
        .get() as { c: number }
    ).c;

    // Skip if counts match (no new packages)
    if (packageCount === symbolPackageCount) {
      return;
    }
  }

  db.run("DELETE FROM packages");

  db.run(`
    INSERT INTO packages (name, manager, symbol_count)
    SELECT
      package,
      'npm' as manager,
      COUNT(*) as symbol_count
    FROM symbols
    WHERE package IS NOT NULL
    GROUP BY package
  `);
}

/**
 * Update metadata table
 */
function updateMetadata(
  db: Database,
  mode: string,
  changedFiles: number,
  deletedFiles: number,
): ConversionStats {
  const totalFiles = (
    db.query("SELECT COUNT(*) as c FROM files").get() as { c: number }
  ).c;
  const totalSymbols = (
    db.query("SELECT COUNT(*) as c FROM symbols").get() as { c: number }
  ).c;

  const metadata = {
    last_indexed: new Date().toISOString(),
    total_files: totalFiles.toString(),
    total_symbols: totalSymbols.toString(),
  };

  for (const [key, value] of Object.entries(metadata)) {
    db.run(
      "INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)",
      key,
      value,
    );
  }

  return {
    mode: mode as "full" | "incremental",
    total_files: totalFiles,
    total_symbols: totalSymbols,
    changed_files: changedFiles,
    deleted_files: deletedFiles,
    time_ms: 0, // Will be set by caller
  };
}
