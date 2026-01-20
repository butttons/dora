// Database query functions

import type { Database } from "bun:sqlite";
import type {
	ComplexityMetric,
	CoupledFiles,
	Cycle,
	DefnEnclosingRange,
	DependencyNode,
	Document,
	ExportedSymbol,
	FileDependency,
	FileDependent,
	FileSymbol,
	GlobalSymbol,
	Hotspot,
	ImportedFile,
	SymbolResult,
	UnusedSymbol,
} from "../types.ts";

// ===== Status Queries =====

export function getFileCount(db: Database): number {
	const result = db.query("SELECT COUNT(*) as count FROM files").get() as {
		count: number;
	};
	return result.count;
}

export function getSymbolCount(db: Database): number {
	const result = db.query("SELECT COUNT(*) as count FROM symbols").get() as {
		count: number;
	};
	return result.count;
}

// ===== Overview Queries =====

export function getPackages(db: Database): string[] {
	// Packages are now pre-computed in the packages table
	const query = `
    SELECT name
    FROM packages
    ORDER BY name
  `;

	const results = db.query(query).all() as { name: string }[];
	return results.map((r) => r.name);
}

/**
 * Find leaf nodes in the dependency graph
 * Leaf nodes are files that few things depend on, but which have their own dependencies
 */
export function getLeafNodes(
	db: Database,
	maxDependents: number = 0,
): string[] {
	const query = `
    SELECT
      f.path,
      COUNT(DISTINCT d_out.to_file_id) as dependencies_count,
      COUNT(DISTINCT d_in.from_file_id) as dependents_count
    FROM files f
    LEFT JOIN dependencies d_out ON d_out.from_file_id = f.id
    LEFT JOIN dependencies d_in ON d_in.to_file_id = f.id
    WHERE
      -- Exclude test files, config files, type definitions
      f.path NOT LIKE '%.test.%'
      AND f.path NOT LIKE '%.spec.%'
      AND f.path NOT LIKE '%config.%'
      AND f.path NOT LIKE '%.d.ts'
      AND f.path NOT LIKE '%.bak.%'
    GROUP BY f.id
    HAVING
      -- Has dependencies (imports other files)
      dependencies_count > 0
      -- But few things depend on it (controlled by maxDependents)
      AND dependents_count <= ?
    ORDER BY dependents_count ASC, f.path
    LIMIT 100
  `;

	const results = db.query(query).all(maxDependents) as { path: string }[];
	return results.map((r) => r.path);
}

// ===== File Queries =====

export function getFileSymbols(
	db: Database,
	relativePath: string,
): FileSymbol[] {
	const query = `
    SELECT
      s.name,
      s.kind,
      s.start_line,
      s.end_line
    FROM symbols s
    JOIN files f ON f.id = s.file_id
    WHERE f.path = ?
    ORDER BY s.start_line
  `;

	const results = db.query(query).all(relativePath) as {
		name: string;
		kind: string;
		start_line: number;
		end_line: number;
	}[];

	return results.map((r) => ({
		name: r.name,
		kind: r.kind,
		lines: [r.start_line, r.end_line] as [number, number],
	}));
}

export function getFileDependencies(
	db: Database,
	relativePath: string,
): FileDependency[] {
	const query = `
    SELECT
      f.path as depends_on,
      d.symbols as symbols_used
    FROM dependencies d
    JOIN files f ON f.id = d.to_file_id
    WHERE d.from_file_id = (SELECT id FROM files WHERE path = ?)
    ORDER BY f.path
  `;

	const results = db.query(query).all(relativePath) as {
		depends_on: string;
		symbols_used: string | null;
	}[];

	return results.map((r) => ({
		path: r.depends_on,
		symbols: r.symbols_used ? JSON.parse(r.symbols_used) : undefined,
	}));
}

export function getFileDependents(
	db: Database,
	relativePath: string,
): FileDependent[] {
	const query = `
    SELECT
      f.path as dependent,
      d.symbol_count as ref_count
    FROM dependencies d
    JOIN files f ON f.id = d.from_file_id
    WHERE d.to_file_id = (SELECT id FROM files WHERE path = ?)
    ORDER BY d.symbol_count DESC
  `;

	const results = db.query(query).all(relativePath) as {
		dependent: string;
		ref_count: number;
	}[];

	return results.map((r) => ({
		path: r.dependent,
		refs: r.ref_count,
	}));
}

// ===== Symbol Queries =====

export function searchSymbols(
	db: Database,
	searchQuery: string,
	options: { kind?: string; limit?: number } = {},
): SymbolResult[] {
	const limit = options.limit || 20;
	const kindFilter = options.kind !== undefined ? "AND s.kind = ?" : "";

	const query = `
    SELECT
      s.name,
      s.kind,
      f.path,
      s.start_line,
      s.end_line
    FROM symbols s
    JOIN files f ON f.id = s.file_id
    WHERE s.name LIKE ?
      AND s.is_local = 0
      ${kindFilter}
    LIMIT ?
  `;

	const params =
		options.kind !== undefined
			? [`%${searchQuery}%`, options.kind, limit]
			: [`%${searchQuery}%`, limit];

	const results = db.query(query).all(...params) as {
		name: string;
		kind: string;
		path: string;
		start_line: number;
		end_line: number;
	}[];

	return results.map((r) => ({
		name: r.name,
		kind: r.kind,
		path: r.path,
		lines: [r.start_line, r.end_line] as [number, number],
	}));
}

// ===== Symbol References Queries =====

export interface SymbolReferencesResult {
	symbol_id: number;
	name: string;
	kind: string;
	definition: {
		path: string;
		line: number;
	};
	references: string[];
}

/**
 * Get all references to a symbol by name
 */
export function getSymbolReferences(
	db: Database,
	symbolName: string,
	options: { kind?: string; limit?: number } = {},
): SymbolReferencesResult[] {
	const limit = options.limit || 100;
	const kindFilter = options.kind !== undefined ? "AND s.kind = ?" : "";

	// Single query with JOIN and GROUP_CONCAT to get all references in one go
	const query = `
    SELECT
      s.id,
      s.name,
      s.kind,
      f1.path as def_path,
      s.start_line as def_line,
      s.reference_count,
      GROUP_CONCAT(DISTINCT f2.path) as ref_paths
    FROM symbols s
    JOIN files f1 ON f1.id = s.file_id
    LEFT JOIN symbol_references sr ON sr.symbol_id = s.id
    LEFT JOIN files f2 ON f2.id = sr.file_id
    WHERE s.name LIKE ?
      AND s.is_local = 0
      ${kindFilter}
    GROUP BY s.id
    HAVING s.reference_count > 0 OR ref_paths IS NOT NULL
    ORDER BY s.reference_count DESC
    LIMIT ?
  `;

	const params =
		options.kind !== undefined
			? [`%${symbolName}%`, options.kind, limit]
			: [`%${symbolName}%`, limit];

	const rows = db.query(query).all(...params) as {
		id: number;
		name: string;
		kind: string;
		def_path: string;
		def_line: number;
		reference_count: number;
		ref_paths: string | null;
	}[];

	return rows.map((row) => ({
		symbol_id: row.id,
		name: row.name,
		kind: row.kind,
		definition: {
			path: row.def_path,
			line: row.def_line,
		},
		references: row.ref_paths ? row.ref_paths.split(",") : [],
	}));
}

// ===== Dependency Graph Queries =====

export function getDependencies(
	db: Database,
	relativePath: string,
	depth: number,
): DependencyNode[] {
	const query = `
    WITH RECURSIVE dep_tree AS (
      -- Base case: start with the target file
      SELECT id, path, 0 as depth
      FROM files
      WHERE path = ?

      UNION

      -- Recursive case: find files that this file depends on
      SELECT DISTINCT f.id, f.path, dt.depth + 1
      FROM dep_tree dt
      JOIN dependencies d ON d.from_file_id = dt.id
      JOIN files f ON f.id = d.to_file_id
      WHERE dt.depth < ?
    )
    SELECT path, MIN(depth) as depth
    FROM dep_tree
    WHERE depth > 0
    GROUP BY path
    ORDER BY depth, path
  `;

	const results = db.query(query).all(relativePath, depth) as {
		path: string;
		depth: number;
	}[];

	return results.map((r) => ({
		path: r.path,
		depth: r.depth,
	}));
}

export function getReverseDependencies(
	db: Database,
	relativePath: string,
	depth: number,
): DependencyNode[] {
	const query = `
    WITH RECURSIVE rdep_tree AS (
      -- Base case: start with the target file
      SELECT id, path, 0 as depth
      FROM files
      WHERE path = ?

      UNION

      -- Recursive case: find files that depend on this file
      SELECT DISTINCT f.id, f.path, rt.depth + 1
      FROM rdep_tree rt
      JOIN dependencies d ON d.to_file_id = rt.id
      JOIN files f ON f.id = d.from_file_id
      WHERE rt.depth < ?
    )
    SELECT path, MIN(depth) as depth
    FROM rdep_tree
    WHERE depth > 0
    GROUP BY path
    ORDER BY depth, path
  `;

	const results = db.query(query).all(relativePath, depth) as {
		path: string;
		depth: number;
	}[];

	return results.map((r) => ({
		path: r.path,
		depth: r.depth,
	}));
}

// ===== Helper Functions =====

/**
 * Check if a file exists in the database
 */
export function fileExists(db: Database, relativePath: string): boolean {
	const query = "SELECT 1 FROM files WHERE path = ? LIMIT 1";
	const result = db.query(query).get(relativePath);
	return result !== null;
}

/**
 * Get files in a directory (or matching a path prefix)
 */
export function getFilesInDirectory(
	db: Database,
	directoryPath: string,
	options: { limit?: number; exactMatch?: boolean } = {},
): string[] {
	const limit = options.limit || 50;

	// For exact directory matching, look for files like "dir/%" but not "dir-other/%"
	const pattern = options.exactMatch
		? `${directoryPath}/%`
		: `${directoryPath}%`;

	const query = `
    SELECT path
    FROM files
    WHERE path LIKE ?
    ORDER BY path
    LIMIT ?
  `;

	const results = db.query(query).all(pattern, limit) as { path: string }[];
	return results.map((r) => r.path);
}

/**
 * Find an index file in a directory using SQL.
 * Searches for common index file patterns in the database.
 * Returns the path if found, or null if not found.
 */
export function findIndexFile(
	db: Database,
	directoryPath: string,
): string | null {
	// Common index file patterns (order matters - prefer TypeScript)
	const indexPatterns = [
		`${directoryPath}/index.ts`,
		`${directoryPath}/index.tsx`,
		`${directoryPath}/index.js`,
		`${directoryPath}/index.jsx`,
		`${directoryPath}/index.mts`,
		`${directoryPath}/index.mjs`,
		`${directoryPath}/index.cjs`,
		`${directoryPath}/index.py`,
		`${directoryPath}/index.go`,
		`${directoryPath}/mod.rs`, // Rust uses mod.rs
		`${directoryPath}/lib.rs`, // Rust lib crates
	];

	// Try each pattern in order
	for (const pattern of indexPatterns) {
		const query = "SELECT path FROM files WHERE path = ? LIMIT 1";
		const result = db.query(query).get(pattern) as { path: string } | null;
		if (result) {
			return result.path;
		}
	}

	return null;
}

// ===== Exports Queries =====

export function getFileExports(
	db: Database,
	relativePath: string,
): ExportedSymbol[] {
	const query = `
    SELECT
      s.name,
      s.kind,
      MIN(s.start_line) as start_line,
      MAX(s.end_line) as end_line
    FROM symbols s
    JOIN files f ON f.id = s.file_id
    WHERE f.path = ?
      AND s.name != ''
      AND s.is_local = 0
    GROUP BY s.name, s.kind
    ORDER BY start_line
  `;

	const results = db.query(query).all(relativePath) as {
		name: string;
		kind: string;
		start_line: number;
		end_line: number;
	}[];

	return results.map((r) => ({
		name: r.name,
		kind: r.kind,
		lines: [r.start_line, r.end_line] as [number, number],
	}));
}

export function getPackageExports(
	db: Database,
	packageName: string,
): ExportedSymbol[] {
	const query = `
    SELECT
      s.name,
      s.kind,
      f.path as file,
      MIN(s.start_line) as start_line,
      MAX(s.end_line) as end_line
    FROM symbols s
    JOIN files f ON f.id = s.file_id
    WHERE s.package = ?
      AND s.name != ''
      AND s.is_local = 0
    GROUP BY s.name, s.kind, f.path
    ORDER BY f.path, start_line
  `;

	const results = db.query(query).all(packageName) as {
		name: string;
		kind: string;
		file: string;
		start_line: number;
		end_line: number;
	}[];

	return results.map((r) => ({
		name: r.name,
		kind: r.kind,
		file: r.file,
		lines: [r.start_line, r.end_line] as [number, number],
	}));
}

// ===== Imports Queries =====

export function getFileImports(
	db: Database,
	relativePath: string,
): ImportedFile[] {
	const query = `
    SELECT
      f.path as file,
      d.symbols
    FROM dependencies d
    JOIN files f ON f.id = d.to_file_id
    WHERE d.from_file_id = (SELECT id FROM files WHERE path = ?)
    ORDER BY f.path
  `;

	const results = db.query(query).all(relativePath) as {
		file: string;
		symbols: string | null;
	}[];

	return results.map((r) => ({
		file: r.file,
		symbols: r.symbols ? JSON.parse(r.symbols) : [],
	}));
}

// ===== Unused Queries =====

export function getUnusedSymbols(db: Database, limit: number): UnusedSymbol[] {
	// Find symbols with no references (using denormalized reference_count field)
	const query = `
    SELECT
      s.name,
      s.kind,
      f.path as file,
      s.start_line,
      s.end_line
    FROM symbols s
    JOIN files f ON f.id = s.file_id
    WHERE s.is_local = 0
      AND s.reference_count = 0
      -- Exclude module and parameter symbols as they're not typically "unused"
      AND s.kind NOT IN ('module', 'parameter')
    ORDER BY f.path, s.start_line
    LIMIT ?
  `;

	const results = db.query(query).all(limit) as {
		name: string;
		kind: string;
		file: string;
		start_line: number;
		end_line: number;
	}[];

	return results.map((r) => ({
		name: r.name,
		file: r.file,
		lines: [r.start_line, r.end_line] as [number, number],
		kind: r.kind,
	}));
}

// ===== Hotspots Queries =====

export function getMostReferencedFiles(db: Database, limit: number): Hotspot[] {
	// Use denormalized dependent_count field for better performance
	const query = `
    SELECT
      f.path as file,
      f.dependent_count as referenced_by
    FROM files f
    WHERE f.dependent_count > 0
    ORDER BY f.dependent_count DESC
    LIMIT ?
  `;

	const results = db.query(query).all(limit) as {
		file: string;
		referenced_by: number;
	}[];

	return results.map((r) => ({
		file: r.file,
		count: r.referenced_by,
	}));
}

export function getMostDependentFiles(db: Database, limit: number): Hotspot[] {
	// Use denormalized dependency_count field for better performance
	const query = `
    SELECT
      f.path as file,
      f.dependency_count as depends_on
    FROM files f
    WHERE f.dependency_count > 0
    ORDER BY f.dependency_count DESC
    LIMIT ?
  `;

	const results = db.query(query).all(limit) as {
		file: string;
		depends_on: number;
	}[];

	return results.map((r) => ({
		file: r.file,
		count: r.depends_on,
	}));
}

// ===== Cycle Detection =====

export function getCycles(db: Database, limit: number = 50): Cycle[] {
	// Find bidirectional dependencies (A -> B -> A)
	// Simple non-recursive query
	const query = `
		SELECT
			f1.path as path1,
			f2.path as path2
		FROM dependencies d1
		JOIN dependencies d2 ON d1.from_file_id = d2.to_file_id
		                     AND d1.to_file_id = d2.from_file_id
		JOIN files f1 ON f1.id = d1.from_file_id
		JOIN files f2 ON f2.id = d1.to_file_id
		WHERE f1.path < f2.path  -- avoid duplicates (only show A->B, not B->A)
		ORDER BY f1.path, f2.path
		LIMIT ?
	`;

	const results = db.query(query).all(limit) as {
		path1: string;
		path2: string;
	}[];

	return results.map((r) => ({
		files: [r.path1, r.path2, r.path1],
		length: 2
	}));
}

// ===== Coupling Analysis =====

export function getCoupledFiles(
	db: Database,
	threshold: number = 5,
): CoupledFiles[] {
	const query = `
    SELECT
      f1.path as file1,
      f2.path as file2,
      d1.symbol_count as symbols_1_to_2,
      d2.symbol_count as symbols_2_to_1,
      (d1.symbol_count + d2.symbol_count) as total_coupling
    FROM dependencies d1
    JOIN dependencies d2 ON d1.from_file_id = d2.to_file_id
                         AND d1.to_file_id = d2.from_file_id
    JOIN files f1 ON f1.id = d1.from_file_id
    JOIN files f2 ON f2.id = d1.to_file_id
    WHERE f1.path < f2.path  -- avoid duplicates
      AND (d1.symbol_count + d2.symbol_count) >= ?  -- threshold
    ORDER BY total_coupling DESC
  `;

	return db.query(query).all(threshold) as CoupledFiles[];
}

// ===== Complexity Metrics =====

export function getComplexityMetrics(
	db: Database,
	sortBy: string = "complexity",
): ComplexityMetric[] {
	const orderByClause =
		sortBy === "symbols"
			? "f.symbol_count DESC"
			: sortBy === "stability"
				? "stability_ratio DESC"
				: "complexity_score DESC";

	const query = `
    SELECT
      f.path,
      f.symbol_count,
      f.dependency_count as outgoing_deps,
      f.dependent_count as incoming_deps,
      CAST(f.dependent_count AS FLOAT) / NULLIF(f.dependency_count, 1) as stability_ratio,
      (f.symbol_count * f.dependent_count) as complexity_score
    FROM files f
    ORDER BY ${orderByClause}
    LIMIT 20
  `;

	return db.query(query).all() as ComplexityMetric[];
}

// ===== Document Queries =====

/**
 * Get documents referencing a symbol
 */
export function getDocumentsForSymbol(
	db: Database,
	symbolId: number,
): Document[] {
	const query = `
    SELECT d.path, d.type
    FROM documents d
    JOIN document_symbol_refs dsr ON dsr.document_id = d.id
    WHERE dsr.symbol_id = ?
    ORDER BY d.path
  `;

	return db.query(query).all(symbolId) as Document[];
}

/**
 * Get documents referencing a file
 */
export function getDocumentsForFile(db: Database, fileId: number): Document[] {
	const query = `
    SELECT d.path, d.type
    FROM documents d
    JOIN document_file_refs dfr ON dfr.document_id = d.id
    WHERE dfr.file_id = ?
    ORDER BY d.path
  `;

	return db.query(query).all(fileId) as Document[];
}

/**
 * Get symbols and files referenced by a document with line numbers
 */
export function getDocumentReferences(db: Database, docPath: string): {
	symbols: import("../types.ts").DocumentSymbolRef[];
	files: import("../types.ts").DocumentFileRef[];
	documents: import("../types.ts").DocumentDocRef[];
} {
	// Get symbols with aggregated line numbers
	const symbolQuery = `
    SELECT
      s.name,
      s.kind,
      f.path,
      s.start_line,
      GROUP_CONCAT(dsr.line) as lines
    FROM symbols s
    JOIN files f ON f.id = s.file_id
    JOIN document_symbol_refs dsr ON dsr.symbol_id = s.id
    JOIN documents d ON d.id = dsr.document_id
    WHERE d.path = ?
    GROUP BY s.id, s.name, s.kind, f.path, s.start_line
    ORDER BY s.name
  `;

	// Get files with aggregated line numbers
	const fileQuery = `
    SELECT
      f.path,
      GROUP_CONCAT(dfr.line) as lines
    FROM files f
    JOIN document_file_refs dfr ON dfr.file_id = f.id
    JOIN documents d ON d.id = dfr.document_id
    WHERE d.path = ?
    GROUP BY f.id, f.path
    ORDER BY f.path
  `;

	// Get documents with aggregated line numbers
	const docQuery = `
    SELECT
      d2.path,
      GROUP_CONCAT(ddr.line) as lines
    FROM documents d2
    JOIN document_document_refs ddr ON ddr.referenced_document_id = d2.id
    JOIN documents d ON d.id = ddr.document_id
    WHERE d.path = ?
    GROUP BY d2.id, d2.path
    ORDER BY d2.path
  `;

	const symbolRows = db.query(symbolQuery).all(docPath) as Array<{
		name: string;
		kind: string;
		path: string;
		start_line: number;
		lines: string;
	}>;

	const fileRows = db.query(fileQuery).all(docPath) as Array<{
		path: string;
		lines: string;
	}>;

	const docRows = db.query(docQuery).all(docPath) as Array<{
		path: string;
		lines: string;
	}>;

	const symbols = symbolRows.map((row) => ({
		name: row.name,
		kind: row.kind,
		path: row.path,
		start_line: row.start_line,
		lines: row.lines.split(",").map((l) => parseInt(l, 10)),
	}));

	const files = fileRows.map((row) => ({
		path: row.path,
		lines: row.lines.split(",").map((l) => parseInt(l, 10)),
	}));

	const documents = docRows.map((row) => ({
		path: row.path,
		lines: row.lines.split(",").map((l) => parseInt(l, 10)),
	}));

	return { symbols, files, documents };
}

/**
 * Get document content and metadata
 */
export function getDocumentContent(
	db: Database,
	docPath: string,
): {
	path: string;
	type: string;
	content: string;
	symbol_count: number;
	file_count: number;
	document_count: number;
} | null {
	const query = `
    SELECT path, type, content, symbol_count, file_count, document_count
    FROM documents
    WHERE path = ?
  `;

	return db.query(query).get(docPath) as {
		path: string;
		type: string;
		content: string;
		symbol_count: number;
		file_count: number;
		document_count: number;
	} | null;
}

/**
 * Get document count
 */
export function getDocumentCount(db: Database): number {
	const result = db.query("SELECT COUNT(*) as count FROM documents").get() as {
		count: number;
	};
	return result.count;
}

/**
 * Get document counts by type
 */
export function getDocumentCountsByType(
	db: Database,
): Array<{ type: string; count: number }> {
	const query = `
    SELECT type, COUNT(*) as count
    FROM documents
    GROUP BY type
    ORDER BY count DESC
  `;

	return db.query(query).all() as Array<{ type: string; count: number }>;
}

/**
 * Search documents by content (case-insensitive LIKE search)
 */
export function searchDocumentContent(
	db: Database,
	searchQuery: string,
	limit: number = 20,
): Array<{
	path: string;
	type: string;
	symbol_count: number;
	file_count: number;
}> {
	const query = `
    SELECT path, type, symbol_count, file_count
    FROM documents
    WHERE content LIKE ?
    ORDER BY symbol_count DESC, file_count DESC
    LIMIT ?
  `;

	return db.query(query).all(`%${searchQuery}%`, limit) as Array<{
		path: string;
		type: string;
		symbol_count: number;
		file_count: number;
	}>;
}
