// Tests for optimized output format (no source, no docs, clean symbols)

import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import {
  getFileDependencies,
  getFileSymbols,
  getLeafNodes,
  searchSymbols,
} from "../../src/db/queries.ts";

describe("Output Format Optimization", () => {
  let db: Database;
  let testDir: string;

  beforeAll(() => {
    // Create in-memory test database
    testDir = "/tmp/dora-output-test-" + Date.now();
    mkdirSync(testDir, { recursive: true });

    db = new Database(":memory:");

    // Create schema
    db.exec(`
      CREATE TABLE files (
        id INTEGER PRIMARY KEY,
        path TEXT UNIQUE NOT NULL,
        language TEXT,
        mtime INTEGER NOT NULL,
        symbol_count INTEGER DEFAULT 0,
        indexed_at INTEGER NOT NULL,
        dependency_count INTEGER DEFAULT 0,
        dependent_count INTEGER DEFAULT 0
      );

      CREATE TABLE symbols (
        id INTEGER PRIMARY KEY,
        file_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        scip_symbol TEXT,
        kind TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        start_char INTEGER NOT NULL,
        end_char INTEGER NOT NULL,
        package TEXT,
        is_local BOOLEAN DEFAULT 0,
        reference_count INTEGER DEFAULT 0,
        FOREIGN KEY (file_id) REFERENCES files(id)
      );

      CREATE TABLE dependencies (
        from_file_id INTEGER NOT NULL,
        to_file_id INTEGER NOT NULL,
        symbol_count INTEGER DEFAULT 1,
        symbols TEXT,
        PRIMARY KEY (from_file_id, to_file_id),
        FOREIGN KEY (from_file_id) REFERENCES files(id),
        FOREIGN KEY (to_file_id) REFERENCES files(id)
      );
    `);

    // Insert test data
    db.run(
      "INSERT INTO files (id, path, language, mtime, indexed_at) VALUES (1, 'src/index.ts', 'typescript', 1000, 1000)",
    );
    db.run(
      "INSERT INTO files (id, path, language, mtime, indexed_at) VALUES (2, 'src/utils.ts', 'typescript', 1000, 1000)",
    );

    // Insert symbols WITHOUT documentation field (the optimization we're testing)
    db.run(`INSERT INTO symbols (file_id, name, scip_symbol, kind, start_line, end_line, start_char, end_char, package, is_local)
            VALUES (1, 'MyClass', 'scip-typescript npm test 1.0.0 src/index.ts/MyClass#', 'class', 5, 10, 0, 1, 'test', 0)`);
    db.run(`INSERT INTO symbols (file_id, name, scip_symbol, kind, start_line, end_line, start_char, end_char, package, is_local)
            VALUES (2, 'helperFunc', 'scip-typescript npm test 1.0.0 src/utils.ts/helperFunc.', 'function', 3, 5, 0, 1, 'test', 0)`);

    // Insert dependencies with clean symbol names (the optimization we're testing)
    db.run(`INSERT INTO dependencies (from_file_id, to_file_id, symbol_count, symbols)
            VALUES (1, 2, 1, '["helperFunc"]')`); // Clean names, not SCIP IDs
  });

  afterAll(() => {
    db.close();
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("File symbols should not include documentation", () => {
    test("symbols should not have doc field", () => {
      const symbols = getFileSymbols(db, "src/index.ts");

      expect(symbols.length).toBeGreaterThan(0);

      // Check that no symbol has a 'doc' field
      for (const symbol of symbols) {
        expect(symbol).not.toHaveProperty("doc");
      }
    });

    test("symbols should have clean structure", () => {
      const symbols = getFileSymbols(db, "src/index.ts");
      const firstSymbol = symbols[0];

      // Should only have: name, kind, lines
      expect(firstSymbol).toHaveProperty("name");
      expect(firstSymbol).toHaveProperty("kind");
      expect(firstSymbol).toHaveProperty("lines");
      expect(Object.keys(firstSymbol).length).toBe(3);
    });
  });

  describe("Dependencies should have clean symbol names", () => {
    test("symbols should be simple names, not SCIP identifiers", () => {
      const deps = getFileDependencies(db, "src/index.ts");

      expect(deps.length).toBeGreaterThan(0);

      const dep = deps[0];
      expect(dep.symbols).toBeDefined();
      expect(dep.symbols!.length).toBeGreaterThan(0);

      // Should be clean name like "helperFunc"
      expect(dep.symbols![0]).toBe("helperFunc");

      // Should NOT contain SCIP prefix
      expect(dep.symbols![0]).not.toContain("scip-typescript");
      expect(dep.symbols![0]).not.toContain(" npm ");
    });

    test("symbols array should not contain empty strings", () => {
      const deps = getFileDependencies(db, "src/index.ts");

      for (const dep of deps) {
        if (dep.symbols) {
          for (const symbol of dep.symbols) {
            expect(symbol).not.toBe("");
            expect(symbol).not.toBe("unknown");
          }
        }
      }
    });
  });

  describe("Symbol search should not include documentation", () => {
    test("searched symbols should not have doc field", () => {
      const results = searchSymbols(db, "MyClass", { limit: 5 });

      expect(results.length).toBeGreaterThan(0);

      for (const result of results) {
        expect(result).not.toHaveProperty("doc");
      }
    });

    test("searched symbols should have clean structure", () => {
      const results = searchSymbols(db, "MyClass", { limit: 5 });
      const firstResult = results[0];

      // Should only have: name, kind, path, lines
      expect(firstResult).toHaveProperty("name");
      expect(firstResult).toHaveProperty("kind");
      expect(firstResult).toHaveProperty("path");
      expect(firstResult).toHaveProperty("lines");
      expect(Object.keys(firstResult).length).toBe(4);
    });
  });

  describe("Leaves command should work with max_dependents parameter", () => {
    test("should exclude test and config files", () => {
      // Add test files
      db.run(
        "INSERT INTO files (id, path, language, mtime, indexed_at) VALUES (10, 'src/foo.test.ts', 'typescript', 1000, 1000)",
      );
      db.run(
        "INSERT INTO files (id, path, language, mtime, indexed_at) VALUES (11, 'config.ts', 'typescript', 1000, 1000)",
      );
      db.run(`INSERT INTO symbols (file_id, name, scip_symbol, kind, start_line, end_line, start_char, end_char, is_local)
              VALUES (10, 'testFunc', 'test', 'function', 1, 2, 0, 1, 0)`);
      db.run(`INSERT INTO symbols (file_id, name, scip_symbol, kind, start_line, end_line, start_char, end_char, is_local)
              VALUES (11, 'config', 'config', 'variable', 1, 2, 0, 1, 0)`);
      db.run(
        "INSERT INTO dependencies (from_file_id, to_file_id, symbol_count, symbols) VALUES (10, 2, 1, '[]')",
      );
      db.run(
        "INSERT INTO dependencies (from_file_id, to_file_id, symbol_count, symbols) VALUES (11, 2, 1, '[]')",
      );

      const leaves = getLeafNodes(db, 0);

      // Should not include test files
      const hasTestFiles = leaves.some((path) => path.includes(".test."));
      expect(hasTestFiles).toBe(false);

      // Should not include config files
      const hasConfigFiles = leaves.some((path) => path.includes("config.ts"));
      expect(hasConfigFiles).toBe(false);
    });
  });
});
