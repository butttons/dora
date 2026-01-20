// Tests for docs command logic
// Tests the query logic used by docs commands without subprocess overhead

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import {
  searchDocumentContent,
  getDocumentContent,
  getDocumentReferences,
} from "../../src/db/queries.ts";

describe("Docs Command Logic", () => {
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
    db.run("INSERT INTO files (id, path) VALUES (1, 'src/database.ts')");

    db.run(
      "INSERT INTO symbols (id, file_id, name, kind, start_line, is_local) VALUES (1, 1, 'DatabaseClient', 'class', 10, 0)"
    );
    db.run(
      "INSERT INTO symbols (id, file_id, name, kind, start_line, is_local) VALUES (2, 1, 'initializeDatabase', 'function', 50, 0)"
    );

    const apiContent = `# API Documentation

The \`DatabaseClient\` class provides database access.
Use \`initializeDatabase\` to set up the connection.
`;

    const readmeContent = `# Project README

This uses DatabaseClient for data persistence.

See [API Documentation](docs/api.md) for more details.
`;

    const setupContent = `# Setup Guide

Refer to the [API Documentation](docs/api.md) for database setup.
Also see [README](README.md) for an overview.
`;

    db.run(
      `INSERT INTO documents (id, path, type, content, mtime, indexed_at, symbol_count, file_count, document_count)
       VALUES (1, 'docs/api.md', 'md', ?, 1000, 2000, 2, 0, 0)`,
      [apiContent]
    );
    db.run(
      `INSERT INTO documents (id, path, type, content, mtime, indexed_at, symbol_count, file_count, document_count)
       VALUES (2, 'README.md', 'md', ?, 1000, 2000, 1, 0, 1)`,
      [readmeContent]
    );
    db.run(
      `INSERT INTO documents (id, path, type, content, mtime, indexed_at, symbol_count, file_count, document_count)
       VALUES (3, 'docs/setup.md', 'md', ?, 1000, 2000, 0, 0, 2)`,
      [setupContent]
    );

    db.run(
      "INSERT INTO document_symbol_refs (document_id, symbol_id, line) VALUES (1, 1, 3)"
    );
    db.run(
      "INSERT INTO document_symbol_refs (document_id, symbol_id, line) VALUES (1, 2, 4)"
    );
    db.run(
      "INSERT INTO document_symbol_refs (document_id, symbol_id, line) VALUES (2, 1, 3)"
    );

    // Insert document-to-document references
    // README.md references docs/api.md on line 5
    db.run(
      "INSERT INTO document_document_refs (document_id, referenced_document_id, line) VALUES (2, 1, 5)"
    );
    // docs/setup.md references docs/api.md on line 3
    db.run(
      "INSERT INTO document_document_refs (document_id, referenced_document_id, line) VALUES (3, 1, 3)"
    );
    // docs/setup.md references README.md on line 4
    db.run(
      "INSERT INTO document_document_refs (document_id, referenced_document_id, line) VALUES (3, 2, 4)"
    );
  });

  afterAll(() => {
    db.close();
  });

  test("docs search logic should find documents by content", () => {
    const results = searchDocumentContent(db, "database", 5);

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.path === "docs/api.md")).toBe(true);
  });

  test("docs find logic should find documents referencing a symbol", () => {
    // Simulate finding symbol ID
    const symbolRow = db
      .query(
        "SELECT id FROM symbols WHERE name = ? AND is_local = 0 LIMIT 1"
      )
      .get("DatabaseClient") as { id: number } | null;

    expect(symbolRow).toBeDefined();

    if (symbolRow) {
      const docsQuery = `
        SELECT
          d.path,
          d.type,
          d.symbol_count as symbol_refs,
          d.file_count as file_refs
        FROM documents d
        JOIN document_symbol_refs dsr ON dsr.document_id = d.id
        WHERE dsr.symbol_id = ?
        ORDER BY d.path
      `;

      const docs = db.query(docsQuery).all(symbolRow.id) as Array<{
        path: string;
        type: string;
        symbol_refs: number;
        file_refs: number;
      }>;

      expect(docs.length).toBe(2);
      expect(docs.some((d) => d.path === "docs/api.md")).toBe(true);
      expect(docs.some((d) => d.path === "README.md")).toBe(true);
    }
  });

  test("docs show logic should display document with references", () => {
    const doc = getDocumentContent(db, "docs/api.md");

    expect(doc).toBeDefined();
    expect(doc?.path).toBe("docs/api.md");
    expect(doc?.type).toBe("md");

    if (doc) {
      const refs = getDocumentReferences(db, "docs/api.md");

      expect(refs.symbols.length).toBe(2);
      expect(refs.symbols.some((s) => s.name === "DatabaseClient")).toBe(true);
      expect(
        refs.symbols.some((s) => s.name === "initializeDatabase")
      ).toBe(true);
    }
  });

  test("docs show logic should include full content when requested", () => {
    const doc = getDocumentContent(db, "docs/api.md");

    expect(doc).toBeDefined();
    expect(doc?.content).toContain("DatabaseClient");
    expect(doc?.content).toContain("initializeDatabase");
  });

  test("docs find logic should handle unknown symbols gracefully", () => {
    const symbolRow = db
      .query(
        "SELECT id FROM symbols WHERE name = ? AND is_local = 0 LIMIT 1"
      )
      .get("NonExistentSymbol") as { id: number } | null;

    expect(symbolRow).toBeNull();
  });

  test("docs show logic should include document references", () => {
    const refs = getDocumentReferences(db, "README.md");

    expect(refs.documents).toBeDefined();
    expect(refs.documents.length).toBe(1);
    expect(refs.documents[0].path).toBe("docs/api.md");
    expect(refs.documents[0].lines).toEqual([5]);
  });

  test("docs show logic should handle multiple document references", () => {
    const refs = getDocumentReferences(db, "docs/setup.md");

    expect(refs.documents).toBeDefined();
    expect(refs.documents.length).toBe(2);

    const apiDocRef = refs.documents.find(d => d.path === "docs/api.md");
    const readmeRef = refs.documents.find(d => d.path === "README.md");

    expect(apiDocRef).toBeDefined();
    expect(apiDocRef?.lines).toEqual([3]);
    expect(readmeRef).toBeDefined();
    expect(readmeRef?.lines).toEqual([4]);
  });

  test("docs find logic should find documents that reference another document", () => {
    const docResult = db
      .query("SELECT id, path FROM documents WHERE path = ?")
      .get("docs/api.md") as { id: number; path: string } | null;

    expect(docResult).toBeDefined();

    if (docResult) {
      const docsQuery = `
        SELECT
          d.path,
          d.type,
          d.symbol_count as symbol_refs,
          d.file_count as file_refs,
          d.document_count as document_refs
        FROM documents d
        JOIN document_document_refs ddr ON ddr.document_id = d.id
        WHERE ddr.referenced_document_id = ?
        ORDER BY d.path
      `;

      const docs = db.query(docsQuery).all(docResult.id) as Array<{
        path: string;
        type: string;
        symbol_refs: number;
        file_refs: number;
        document_refs: number;
      }>;

      expect(docs.length).toBe(2);
      expect(docs.some((d) => d.path === "README.md")).toBe(true);
      expect(docs.some((d) => d.path === "docs/setup.md")).toBe(true);

      // Check that document_count is included
      const setupDoc = docs.find((d) => d.path === "docs/setup.md");
      expect(setupDoc?.document_refs).toBe(2);
    }
  });

  test("docs show logic should include document_count in metadata", () => {
    const doc = getDocumentContent(db, "docs/setup.md");

    expect(doc).toBeDefined();
    expect(doc?.document_count).toBe(2);
  });
});
