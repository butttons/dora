import type { Database } from "bun:sqlite";
import { join } from "path";
import {
	type DocumentFile,
	filterChangedDocuments,
	scanDocumentFiles,
} from "../utils/fileScanner.js";
import { debugDocs } from "../utils/logger.js";

export interface DocumentProcessingStats {
	processed: number;
	skipped: number;
	total: number;
}

interface SymbolReference {
	symbolId: number;
	line: number;
}

interface FileReference {
	fileId: number;
	line: number;
}

interface DocReference {
	docId: number;
	line: number;
}

interface DocumentReference {
	symbolRefs: SymbolReference[];
	fileRefs: FileReference[];
	docRefs: DocReference[];
}

/**
 * Process documentation files and index them in the database
 */
export async function processDocuments({
	db,
	repoRoot,
	mode,
	ignorePatterns = [],
}: {
	db: Database;
	repoRoot: string;
	mode: "full" | "incremental";
	ignorePatterns?: string[];
}): Promise<DocumentProcessingStats> {
	debugDocs("Starting document processing in %s mode", mode);

	const startTime = Date.now();

	// Scan for document files
	const scannedDocs = await scanDocumentFiles({
		repoRoot,
		extensions: [".md", ".txt"],
		ignorePatterns,
	});
	debugDocs("Scanned %d document files", scannedDocs.length);

	let docsToProcess: DocumentFile[];

	if (mode === "incremental") {
		// Get existing documents from database
		const existingDocs = new Map<string, number>();
		const rows = db.query("SELECT path, mtime FROM documents").all() as Array<{
			path: string;
			mtime: number;
		}>;

		for (const row of rows) {
			existingDocs.set(row.path, row.mtime);
		}

		// Filter to only changed documents
		docsToProcess = filterChangedDocuments({ existingDocs, scannedDocs });
		debugDocs("Incremental mode: %d documents changed", docsToProcess.length);

		// Remove documents that no longer exist
		const scannedPaths = new Set(scannedDocs.map((d) => d.path));
		const deletedDocs = Array.from(existingDocs.keys()).filter(
			(path) => !scannedPaths.has(path),
		);

		if (deletedDocs.length > 0) {
			debugDocs("Removing %d deleted documents", deletedDocs.length);
			const deleteStmt = db.prepare("DELETE FROM documents WHERE path = ?");
			for (const path of deletedDocs) {
				deleteStmt.run(path);
			}
		}
	} else {
		// Full rebuild: clear existing documents
		debugDocs("Full mode: clearing existing documents");
		db.run("DELETE FROM documents");
		db.run("DELETE FROM document_symbol_refs");
		db.run("DELETE FROM document_file_refs");
		db.run("DELETE FROM document_document_refs");
		docsToProcess = scannedDocs;
	}

	// Process each document
	let processed = 0;
	const insertDocStmt = db.prepare(`
    INSERT OR REPLACE INTO documents (path, type, content, mtime, indexed_at, symbol_count, file_count, document_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

	const getDocIdStmt = db.prepare("SELECT id FROM documents WHERE path = ?");

	const BATCH_SIZE = 500;

	for (const doc of docsToProcess) {
		try {
			const fullPath = join(repoRoot, doc.path);
			const content = await Bun.file(fullPath).text();

			// Extract references from content
			const refs = extractReferences({ content, db });

			// Insert document
			const now = Date.now();
			insertDocStmt.run(
				doc.path,
				doc.type,
				content,
				doc.mtime,
				now,
				refs.symbolRefs.length,
				refs.fileRefs.length,
				refs.docRefs.length,
			);

			// Get the document ID
			const docRow = getDocIdStmt.get(doc.path) as { id: number } | null;
			if (!docRow) {
				debugDocs("Failed to get document ID for %s", doc.path);
				continue;
			}

			// Clear existing references for this document
			db.run("DELETE FROM document_symbol_refs WHERE document_id = ?", [
				docRow.id,
			]);
			db.run("DELETE FROM document_file_refs WHERE document_id = ?", [
				docRow.id,
			]);
			db.run("DELETE FROM document_document_refs WHERE document_id = ?", [
				docRow.id,
			]);

			batchInsert({
				db,
				table: "document_symbol_refs",
				columns: ["document_id", "symbol_id", "line"],
				rows: refs.symbolRefs.map((r) => [docRow.id, r.symbolId, r.line]),
				batchSize: BATCH_SIZE,
			});

			batchInsert({
				db,
				table: "document_file_refs",
				columns: ["document_id", "file_id", "line"],
				rows: refs.fileRefs.map((r) => [docRow.id, r.fileId, r.line]),
				batchSize: BATCH_SIZE,
			});

			batchInsert({
				db,
				table: "document_document_refs",
				columns: ["document_id", "referenced_document_id", "line"],
				rows: refs.docRefs.map((r) => [docRow.id, r.docId, r.line]),
				batchSize: BATCH_SIZE,
			});

			processed++;
		} catch (error) {
			debugDocs("Error processing document %s: %s", doc.path, error);
		}
	}

	const elapsedMs = Date.now() - startTime;
	debugDocs(
		"Document processing complete: %d processed, %d skipped in %dms",
		processed,
		scannedDocs.length - processed,
		elapsedMs,
	);

	return {
		processed,
		skipped: scannedDocs.length - processed,
		total: scannedDocs.length,
	};
}

/**
 * Extract references to symbols and files from document content with line numbers
 */
function extractReferences({
	content,
	db,
}: {
	content: string;
	db: Database;
}): DocumentReference {
	const symbolRefs: SymbolReference[] = [];
	const fileRefs: FileReference[] = [];
	const docRefs: DocReference[] = [];
	const symbolRefsMap = new Map<number, Set<number>>(); // symbolId -> Set of line numbers
	const fileRefsMap = new Map<number, Set<number>>(); // fileId -> Set of line numbers
	const docRefsMap = new Map<number, Set<number>>(); // docId -> Set of line numbers

	// Split content into lines (1-indexed like in editors)
	const lines = content.split("\n");

	// Get eligible symbols (non-local, specific kinds only)
	// Order by name length DESC to match longer names first (e.g., "AuthService" before "Auth")
	const symbols = db
		.query(
			`
    SELECT id, name FROM symbols
    WHERE is_local = 0
      AND kind IN ('class', 'function', 'interface', 'method', 'type', 'type_alias', 'enum')
    ORDER BY LENGTH(name) DESC
  `,
		)
		.all() as Array<{ id: number; name: string }>;

	// Get all indexed files
	const files = db.query("SELECT id, path FROM files").all() as Array<{
		id: number;
		path: string;
	}>;

	const filePathMap = new Map<string, number>();
	for (const file of files) {
		filePathMap.set(file.path, file.id);
	}

	const docPathMap = new Map<string, number>();
	const docs = db.query("SELECT id, path FROM documents").all() as Array<{
		id: number;
		path: string;
	}>;
	for (const doc of docs) {
		docPathMap.set(doc.path, doc.id);
	}

	const allContent = content;
	for (const sym of symbols) {
		const escapedName = escapeRegex(sym.name);
		const regex = new RegExp(`\\b${escapedName}\\b`, "gm");
		let match;

		while ((match = regex.exec(allContent)) !== null) {
			const lineNumber = allContent
				.substring(0, match.index)
				.split("\n").length;

			if (!symbolRefsMap.has(sym.id)) {
				symbolRefsMap.set(sym.id, new Set());
			}
			symbolRefsMap.get(sym.id)!.add(lineNumber);
		}
	}

	// Process each line for file path matching
	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const lineContent = lines[lineIndex];
		if (!lineContent) continue;
		const lineNumber = lineIndex + 1; // 1-indexed

		// Match file paths (direct mentions)
		for (const file of files) {
			if (lineContent.includes(file.path)) {
				if (!fileRefsMap.has(file.id)) {
					fileRefsMap.set(file.id, new Set());
				}
				fileRefsMap.get(file.id)!.add(lineNumber);
			}
		}

		// Extract markdown links: [text](path)
		const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
		let match;
		while ((match = linkRegex.exec(lineContent)) !== null) {
			const linkPath = match[2];
			if (!linkPath) continue;

			// Skip URLs
			if (linkPath.startsWith("http://") || linkPath.startsWith("https://")) {
				continue;
			}

			// Normalize path
			const normalized = normalizePath(linkPath);
			if (!normalized) continue;

			const fileId = filePathMap.get(normalized);
			if (fileId !== undefined) {
				if (!fileRefsMap.has(fileId)) {
					fileRefsMap.set(fileId, new Set());
				}
				fileRefsMap.get(fileId)!.add(lineNumber);
				continue;
			}

			const docId = docPathMap.get(normalized);
			if (docId !== undefined) {
				if (!docRefsMap.has(docId)) {
					docRefsMap.set(docId, new Set());
				}
				docRefsMap.get(docId)!.add(lineNumber);
			}
		}
	}

	// Convert maps to arrays of references
	for (const [symbolId, lineNumbers] of symbolRefsMap.entries()) {
		for (const line of lineNumbers) {
			symbolRefs.push({ symbolId, line });
		}
	}

	for (const [fileId, lineNumbers] of fileRefsMap.entries()) {
		for (const line of lineNumbers) {
			fileRefs.push({ fileId, line });
		}
	}

	for (const [docId, lineNumbers] of docRefsMap.entries()) {
		for (const line of lineNumbers) {
			docRefs.push({ docId, line });
		}
	}

	debugDocs(
		"Extracted %d symbol refs, %d file refs, and %d doc refs",
		symbolRefs.length,
		fileRefs.length,
		docRefs.length,
	);

	return {
		symbolRefs,
		fileRefs,
		docRefs,
	};
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Normalize a file path (remove leading ./, handle relative paths)
 */
function normalizePath(path: string): string {
	// Remove leading ./
	if (path.startsWith("./")) {
		path = path.slice(2);
	}

	// Remove leading /
	if (path.startsWith("/")) {
		path = path.slice(1);
	}

	// Remove anchor/query strings
	const hashIndex = path.indexOf("#");
	if (hashIndex !== -1) {
		path = path.slice(0, hashIndex);
	}

	const queryIndex = path.indexOf("?");
	if (queryIndex !== -1) {
		path = path.slice(0, queryIndex);
	}

	return path;
}

/**
 * Insert rows in batches for better performance
 */
function batchInsert({
	db,
	table,
	columns,
	rows,
	batchSize,
}: {
	db: Database;
	table: string;
	columns: string[];
	rows: Array<Array<string | number>>;
	batchSize: number;
}): void {
	if (rows.length === 0) {
		return;
	}

	const columnList = columns.join(", ");

	for (let i = 0; i < rows.length; i += batchSize) {
		const batch = rows.slice(i, i + batchSize);
		const valuePlaceholders = batch
			.map(() => `(${columns.map(() => "?").join(", ")})`)
			.join(", ");

		const sql = `INSERT INTO ${table} (${columnList}) VALUES ${valuePlaceholders}`;
		const flatValues = batch.flat();

		db.run(sql, flatValues);
	}
}
