// Integration tests for database queries

import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  getDependencies,
  getFileDependencies,
  getFileDependents,
  getFileSymbols,
  getReverseDependencies,
  searchSymbols,
} from "../../src/db/queries.ts";

describe("Database Queries", () => {
  let db: Database;

  beforeAll(() => {
    // Create in-memory test database
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

      CREATE TABLE symbol_references (
        id INTEGER PRIMARY KEY,
        symbol_id INTEGER NOT NULL,
        file_id INTEGER NOT NULL,
        line INTEGER NOT NULL,
        FOREIGN KEY (symbol_id) REFERENCES symbols(id),
        FOREIGN KEY (file_id) REFERENCES files(id)
      );

      CREATE TABLE packages (
        id INTEGER PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        manager TEXT NOT NULL,
        version TEXT,
        symbol_count INTEGER DEFAULT 0
      );
    `);

    // Insert test files
    db.run(
      "INSERT INTO files (id, path, language, mtime, indexed_at) VALUES (1, 'packages/app-utils/src/index.ts', 'typescript', 1000, 1000)"
    );
    db.run(
      "INSERT INTO files (id, path, language, mtime, indexed_at) VALUES (2, 'packages/app-utils/src/logger.ts', 'typescript', 1000, 1000)"
    );
    db.run(
      "INSERT INTO files (id, path, language, mtime, indexed_at) VALUES (3, 'apps/api-worker/src/index.ts', 'typescript', 1000, 1000)"
    );
    db.run(
      "INSERT INTO files (id, path, language, mtime, indexed_at) VALUES (4, 'packages/app-auth/src/index.ts', 'typescript', 1000, 1000)"
    );

    // Insert test symbols (all non-local symbols, so is_local = 0)
    db.run(`INSERT INTO symbols (id, file_id, name, scip_symbol, kind, start_line, end_line, start_char, end_char, package, is_local)
            VALUES (1, 1, 'exportUtils', 'scip-typescript npm @pkg/app-utils 1.0.0 src/index.ts/exportUtils.', 'function', 5, 10, 0, 1, '@pkg/app-utils', 0)`);
    db.run(`INSERT INTO symbols (id, file_id, name, scip_symbol, kind, start_line, end_line, start_char, end_char, package, is_local)
            VALUES (2, 2, 'Logger', 'scip-typescript npm @pkg/app-utils 1.0.0 src/logger.ts/Logger#', 'interface', 3, 8, 0, 1, '@pkg/app-utils', 0)`);
    db.run(`INSERT INTO symbols (id, file_id, name, scip_symbol, kind, start_line, end_line, start_char, end_char, package, is_local)
            VALUES (3, 3, 'main', 'scip-typescript npm @pkg/api-worker 1.0.0 src/index.ts/main.', 'function', 1, 5, 0, 1, '@pkg/api-worker', 0)`);
    db.run(`INSERT INTO symbols (id, file_id, name, scip_symbol, kind, start_line, end_line, start_char, end_char, package, is_local)
            VALUES (4, 4, 'AuthSession', 'scip-typescript npm @pkg/app-auth 1.0.0 src/index.ts/AuthSession#', 'type', 2, 6, 0, 1, '@pkg/app-auth', 0)`);

    // Insert dependencies
    db.run(`INSERT INTO dependencies (from_file_id, to_file_id, symbol_count, symbols)
            VALUES (1, 2, 1, '["Logger"]')`);
    db.run(`INSERT INTO dependencies (from_file_id, to_file_id, symbol_count, symbols)
            VALUES (3, 1, 1, '["exportUtils"]')`);
    db.run(`INSERT INTO dependencies (from_file_id, to_file_id, symbol_count, symbols)
            VALUES (3, 2, 1, '["Logger"]')`);
    db.run(`INSERT INTO dependencies (from_file_id, to_file_id, symbol_count, symbols)
            VALUES (3, 4, 1, '["AuthSession"]')`);

    // Insert symbol references
    db.run(
      "INSERT INTO symbol_references (symbol_id, file_id, line) VALUES (2, 3, 10)"
    );
    db.run(
      "INSERT INTO symbol_references (symbol_id, file_id, line) VALUES (1, 3, 15)"
    );

    // Insert packages
    db.run(
      "INSERT INTO packages (name, manager, symbol_count) VALUES ('@pkg/app-utils', 'npm', 2)"
    );
    db.run(
      "INSERT INTO packages (name, manager, symbol_count) VALUES ('@pkg/api-worker', 'npm', 1)"
    );
    db.run(
      "INSERT INTO packages (name, manager, symbol_count) VALUES ('@pkg/app-auth', 'npm', 1)"
    );
  });

  afterAll(() => {
    db.close();
  });

  // Note: Trivial queries (getFileCount, getSymbolCount, getPackages) are not tested
  // They're simple SELECT COUNT(*) or SELECT name queries with no complex logic

  describe("File Queries", () => {
    test("getFileSymbols should return symbols for a file", () => {
      const symbols = getFileSymbols(db, "packages/app-utils/src/index.ts");

      expect(Array.isArray(symbols)).toBe(true);
      // File should have at least one symbol (module)
      expect(symbols.length).toBeGreaterThanOrEqual(1);

      if (symbols.length > 0) {
        expect(symbols[0]).toHaveProperty("name");
        expect(symbols[0]).toHaveProperty("kind");
        expect(symbols[0]).toHaveProperty("lines");
      }
    });

    test("getFileDependencies should return dependencies", () => {
      const deps = getFileDependencies(db, "packages/app-utils/src/index.ts");

      expect(Array.isArray(deps)).toBe(true);

      if (deps.length > 0) {
        expect(deps[0]).toHaveProperty("path");
      }
    });

    test("getFileDependents should return dependents", () => {
      const dependents = getFileDependents(
        db,
        "packages/app-utils/src/logger.ts"
      );

      expect(Array.isArray(dependents)).toBe(true);
      // logger.ts is used by other files, so should have dependents
      expect(dependents.length).toBeGreaterThan(0);

      expect(dependents[0]!).toHaveProperty("path");
      expect(dependents[0]!).toHaveProperty("refs");
      expect(typeof dependents[0]!.refs).toBe("number");
    });
  });

  describe("Symbol Queries", () => {
    test("searchSymbols should find symbols by name", () => {
      const results = searchSymbols(db, "Logger", { limit: 10 });

      expect(Array.isArray(results)).toBe(true);

      if (results.length > 0) {
        expect(results[0]).toHaveProperty("name");
        expect(results[0]).toHaveProperty("kind");
        expect(results[0]).toHaveProperty("path");
      }
    });

    test("searchSymbols should respect limit option", () => {
      const results = searchSymbols(db, "index", { limit: 5 });

      expect(results.length).toBeLessThanOrEqual(5);
    });

    test("searchSymbols should return empty array for non-existent symbol", () => {
      const results = searchSymbols(db, "NonExistentSymbolXYZ123", {
        limit: 10,
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe("Dependency Graph Queries", () => {
    test("getDependencies should return dependencies at depth 1", () => {
      const deps = getDependencies(db, "packages/app-utils/src/index.ts", 1);

      expect(Array.isArray(deps)).toBe(true);
      // Should have logger.ts as dependency
      expect(deps.length).toBeGreaterThan(0);

      if (deps.length > 0) {
        expect(deps[0]!).toHaveProperty("path");
        expect(deps[0]!).toHaveProperty("depth");
        expect(deps[0]!.depth).toBe(1);
      }
    });

    test("getDependencies should handle depth 2", () => {
      const deps = getDependencies(db, "apps/api-worker/src/index.ts", 2);

      expect(Array.isArray(deps)).toBe(true);
      // api-worker depends on multiple files at different depths
      expect(deps.length).toBeGreaterThan(0);
    });

    test("getReverseDependencies should return dependents", () => {
      const rdeps = getReverseDependencies(
        db,
        "packages/app-utils/src/logger.ts",
        1
      );

      expect(Array.isArray(rdeps)).toBe(true);
      expect(rdeps.length).toBeGreaterThan(0);

      expect(rdeps[0]!).toHaveProperty("path");
      expect(rdeps[0]!).toHaveProperty("depth");
      expect(rdeps[0]!.depth).toBe(1);
    });

    test("getDependencies should return empty array for file with no deps", () => {
      const deps = getDependencies(db, "packages/app-utils/src/logger.ts", 1);

      expect(Array.isArray(deps)).toBe(true);
      // logger.ts has no dependencies in our test data
      expect(deps.length).toBe(0);
    });
  });
});
