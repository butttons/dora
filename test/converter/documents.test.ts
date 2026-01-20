// Tests for document processing

import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { processDocuments } from "../../src/converter/documents.ts";

describe("Document Processing", () => {
	const testDir = join(process.cwd(), "test", "fixtures", "test-docs");
	let db: Database;

	beforeAll(async () => {
		// Create test directory and files
		await mkdir(testDir, { recursive: true });

		// Create markdown doc with symbol references
		await writeFile(
			join(testDir, "API.md"),
			`# API Documentation

The \`Logger\` class provides logging functionality.
Use \`parseConfig\` function to parse configuration files.

See src/logger.ts for implementation.
`,
		);

		// Create JSON config
		await writeFile(
			join(testDir, "config.json"),
			JSON.stringify({ key: "value" }),
		);

		// Setup in-memory database with schema
		db = new Database(":memory:");

		// Create minimal schema
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
		db.run("INSERT INTO files (id, path) VALUES (1, 'src/logger.ts')");
		db.run(
			"INSERT INTO symbols (id, file_id, name, kind, is_local) VALUES (1, 1, 'Logger', 'class', 0)",
		);
		db.run(
			"INSERT INTO symbols (id, file_id, name, kind, is_local) VALUES (2, 1, 'parseConfig', 'function', 0)",
		);
	});

	afterAll(async () => {
		db.close();
		await rm(testDir, { recursive: true, force: true });
	});

	test("should process documents and extract references", async () => {
		const stats = await processDocuments(db, testDir, "full");

		expect(stats.processed).toBe(2);
		expect(stats.total).toBe(2);
	});

	test("should store document content", async () => {
		await processDocuments(db, testDir, "full");

		const doc = db
			.query("SELECT * FROM documents WHERE path = ?")
			.get("API.md") as any;

		expect(doc).toBeDefined();
		expect(doc.type).toBe("md");
		expect(doc.content).toContain("Logger");
		expect(doc.symbol_count).toBeGreaterThan(0);
	});

	test("should extract symbol references", async () => {
		await processDocuments(db, testDir, "full");

		const refs = db
			.query(
				`
      SELECT s.name
      FROM document_symbol_refs dsr
      JOIN symbols s ON s.id = dsr.symbol_id
      JOIN documents d ON d.id = dsr.document_id
      WHERE d.path = ?
    `,
			)
			.all("API.md") as Array<{ name: string }>;

		const symbolNames = refs.map((r) => r.name);
		expect(symbolNames).toContain("Logger");
		expect(symbolNames).toContain("parseConfig");
	});

	test("should extract file references", async () => {
		await processDocuments(db, testDir, "full");

		const refs = db
			.query(
				`
      SELECT f.path
      FROM document_file_refs dfr
      JOIN files f ON f.id = dfr.file_id
      JOIN documents d ON d.id = dfr.document_id
      WHERE d.path = ?
    `,
			)
			.all("API.md") as Array<{ path: string }>;

		const filePaths = refs.map((r) => r.path);
		expect(filePaths).toContain("src/logger.ts");
	});

	test("should support incremental mode", async () => {
		// First full process
		await processDocuments(db, testDir, "full");

		// Second incremental process (no changes)
		const stats = await processDocuments(db, testDir, "incremental");

		// Should skip unchanged files
		expect(stats.skipped).toBeGreaterThan(0);
	});
});
