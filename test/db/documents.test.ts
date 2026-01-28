// Tests for document database queries

import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	getDocumentContent,
	getDocumentReferences,
	getDocumentsForFile,
	getDocumentsForSymbol,
	searchDocumentContent,
} from "../../src/db/queries.ts";

describe("Document Queries", () => {
	let db: Database;

	beforeAll(() => {
		// Setup in-memory database
		db = new Database(":memory:");

		// Create schema
		db.run(`
      CREATE TABLE files (
        id INTEGER PRIMARY KEY,
        path TEXT UNIQUE NOT NULL
      )
    `);

		db.run(`
      CREATE TABLE symbols (
        id INTEGER PRIMARY KEY,
        file_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        is_local BOOLEAN DEFAULT 0,
        FOREIGN KEY (file_id) REFERENCES files(id)
      )
    `);

		db.run(`
      CREATE TABLE documents (
        id INTEGER PRIMARY KEY,
        path TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        mtime INTEGER NOT NULL,
        indexed_at INTEGER NOT NULL,
        symbol_count INTEGER DEFAULT 0,
        file_count INTEGER DEFAULT 0,
        document_count INTEGER DEFAULT 0
      )
    `);

		db.run(`
      CREATE TABLE document_symbol_refs (
        id INTEGER PRIMARY KEY,
        document_id INTEGER NOT NULL,
        symbol_id INTEGER NOT NULL,
        line INTEGER NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents(id),
        FOREIGN KEY (symbol_id) REFERENCES symbols(id)
      )
    `);

		db.run(`
      CREATE TABLE document_file_refs (
        id INTEGER PRIMARY KEY,
        document_id INTEGER NOT NULL,
        file_id INTEGER NOT NULL,
        line INTEGER NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents(id),
        FOREIGN KEY (file_id) REFERENCES files(id)
      )
    `);

		db.run(`
      CREATE TABLE document_document_refs (
        id INTEGER PRIMARY KEY,
        document_id INTEGER NOT NULL,
        referenced_document_id INTEGER NOT NULL,
        line INTEGER NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents(id),
        FOREIGN KEY (referenced_document_id) REFERENCES documents(id)
      )
    `);

		// Insert test data
		db.run("INSERT INTO files (id, path) VALUES (1, 'src/auth.ts')");
		db.run("INSERT INTO files (id, path) VALUES (2, 'src/logger.ts')");

		db.run(
			"INSERT INTO symbols (id, file_id, name, kind, start_line, is_local) VALUES (1, 1, 'AuthService', 'class', 10, 0)",
		);
		db.run(
			"INSERT INTO symbols (id, file_id, name, kind, start_line, is_local) VALUES (2, 2, 'Logger', 'interface', 5, 0)",
		);

		db.run(
			`INSERT INTO documents (id, path, type, content, mtime, indexed_at, symbol_count, file_count, document_count)
       VALUES (1, 'docs/auth.md', 'md', 'The AuthService class handles authentication. See src/auth.ts for details.', 1000, 2000, 1, 1, 0)`,
		);
		db.run(
			`INSERT INTO documents (id, path, type, content, mtime, indexed_at, symbol_count, file_count, document_count)
       VALUES (2, 'README.md', 'md', 'This project uses Logger interface and AuthService for authentication.', 1000, 2000, 2, 0, 0)`,
		);

		db.run(
			"INSERT INTO document_symbol_refs (document_id, symbol_id, line) VALUES (1, 1, 5)",
		);
		db.run(
			"INSERT INTO document_symbol_refs (document_id, symbol_id, line) VALUES (2, 1, 3)",
		);
		db.run(
			"INSERT INTO document_symbol_refs (document_id, symbol_id, line) VALUES (2, 2, 8)",
		);

		db.run(
			"INSERT INTO document_file_refs (document_id, file_id, line) VALUES (1, 1, 10)",
		);
	});

	afterAll(() => {
		db.close();
	});

	test("getDocumentsForSymbol should return documents referencing a symbol", () => {
		const docs = getDocumentsForSymbol(db, 1); // AuthService

		expect(docs.length).toBe(2);
		expect(docs.some((d) => d.path === "docs/auth.md")).toBe(true);
		expect(docs.some((d) => d.path === "README.md")).toBe(true);
	});

	test("getDocumentsForFile should return documents referencing a file", () => {
		const docs = getDocumentsForFile(db, 1); // src/auth.ts

		expect(docs.length).toBe(1);
		expect(docs[0]!.path).toBe("docs/auth.md");
	});

	test("getDocumentReferences should return symbols and files referenced by a document", () => {
		const refs = getDocumentReferences(db, "docs/auth.md");

		expect(refs.symbols.length).toBe(1);
		expect(refs.symbols[0]!.name).toBe("AuthService");
		expect(refs.files.length).toBe(1);
		expect(refs.files[0]!.path).toBe("src/auth.ts");
		expect(refs.documents).toBeDefined();
		expect(refs.documents.length).toBe(0); // No document references in this test data
	});

	test("getDocumentContent should return document with metadata", () => {
		const doc = getDocumentContent(db, "README.md");

		expect(doc).toBeDefined();
		expect(doc?.type).toBe("md");
		expect(doc?.content).toContain("Logger");
		expect(doc?.symbol_count).toBe(2);
		expect(doc?.file_count).toBe(0);
	});

	test("getDocumentContent should return null for non-existent document", () => {
		const doc = getDocumentContent(db, "nonexistent.md");

		expect(doc).toBeNull();
	});

	test("searchDocumentContent should find documents by content", () => {
		const results = searchDocumentContent(db, "authentication", 10);

		expect(results.length).toBeGreaterThan(0);
		expect(results.some((r) => r.path === "docs/auth.md")).toBe(true);
	});

	test("searchDocumentContent should be case-insensitive", () => {
		const results = searchDocumentContent(db, "LOGGER", 10);

		expect(results.length).toBeGreaterThan(0);
		expect(results.some((r) => r.path === "README.md")).toBe(true);
	});

	test("searchDocumentContent should respect limit", () => {
		const results = searchDocumentContent(db, "the", 1);

		expect(results.length).toBeLessThanOrEqual(1);
	});

	test("searchDocumentContent should order by relevance", () => {
		const results = searchDocumentContent(db, "auth", 10);

		// Document with more symbols should come first
		if (results.length > 1) {
			expect(results[0]!.symbol_count).toBeGreaterThanOrEqual(
				results[results.length - 1]!.symbol_count,
			);
		}
	});
});
