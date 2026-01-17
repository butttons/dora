// Tests for getCycles - Circular dependency detection

import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getCycles } from "../../src/db/queries.ts";

describe("getCycles - Circular Dependency Detection", () => {
	let db: Database;

	beforeAll(() => {
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
	});

	afterAll(() => {
		db.close();
	});

	describe("No cycles", () => {
		test("should return empty array when no cycles exist", () => {
			// Clean DAG: A -> B -> C
			db.exec("DELETE FROM dependencies");
			db.exec("DELETE FROM files");

			db.run(
				"INSERT INTO files (id, path, language, mtime, indexed_at) VALUES (1, 'a.ts', 'typescript', 1000, 1000)",
			);
			db.run(
				"INSERT INTO files (id, path, language, mtime, indexed_at) VALUES (2, 'b.ts', 'typescript', 1000, 1000)",
			);
			db.run(
				"INSERT INTO files (id, path, language, mtime, indexed_at) VALUES (3, 'c.ts', 'typescript', 1000, 1000)",
			);

			db.run(
				"INSERT INTO dependencies (from_file_id, to_file_id, symbol_count) VALUES (1, 2, 1)",
			);
			db.run(
				"INSERT INTO dependencies (from_file_id, to_file_id, symbol_count) VALUES (2, 3, 1)",
			);

			const cycles = getCycles(db, 50);

			expect(cycles).toHaveLength(0);
		});
	});

	describe("Simple 2-file cycles", () => {
		test("should detect A -> B -> A cycle", () => {
			db.exec("DELETE FROM dependencies");
			db.exec("DELETE FROM files");

			db.run(
				"INSERT INTO files (id, path, language, mtime, indexed_at) VALUES (1, 'a.ts', 'typescript', 1000, 1000)",
			);
			db.run(
				"INSERT INTO files (id, path, language, mtime, indexed_at) VALUES (2, 'b.ts', 'typescript', 1000, 1000)",
			);

			// Create cycle: A -> B -> A
			db.run(
				"INSERT INTO dependencies (from_file_id, to_file_id, symbol_count) VALUES (1, 2, 1)",
			);
			db.run(
				"INSERT INTO dependencies (from_file_id, to_file_id, symbol_count) VALUES (2, 1, 1)",
			);

			const cycles = getCycles(db, 50);

			expect(cycles.length).toBeGreaterThan(0);

			// Should find the 2-file cycle
			const twoFileCycle = cycles.find((c) => c.length === 2);
			expect(twoFileCycle).toBeDefined();
			expect(twoFileCycle!.files).toHaveLength(3); // [A, B, A]

			// Verify cycle structure
			const files = twoFileCycle!.files;
			expect(files[0]).toBe(files[2]); // Start and end are the same
			expect(files).toContain("a.ts");
			expect(files).toContain("b.ts");
		});
	});

	// Note: getCycles only detects 2-file cycles (bidirectional dependencies)
	// For longer cycles (A -> B -> C -> A), use custom SQL queries via `dora query`

	describe("Multiple cycles", () => {
		test("should detect multiple independent cycles", () => {
			db.exec("DELETE FROM dependencies");
			db.exec("DELETE FROM files");

			// Create two independent cycles:
			// Cycle 1: A -> B -> A
			// Cycle 2: C -> D -> C

			db.run(
				"INSERT INTO files (id, path, language, mtime, indexed_at) VALUES (1, 'a.ts', 'typescript', 1000, 1000)",
			);
			db.run(
				"INSERT INTO files (id, path, language, mtime, indexed_at) VALUES (2, 'b.ts', 'typescript', 1000, 1000)",
			);
			db.run(
				"INSERT INTO files (id, path, language, mtime, indexed_at) VALUES (3, 'c.ts', 'typescript', 1000, 1000)",
			);
			db.run(
				"INSERT INTO files (id, path, language, mtime, indexed_at) VALUES (4, 'd.ts', 'typescript', 1000, 1000)",
			);

			// Cycle 1: A <-> B
			db.run(
				"INSERT INTO dependencies (from_file_id, to_file_id, symbol_count) VALUES (1, 2, 1)",
			);
			db.run(
				"INSERT INTO dependencies (from_file_id, to_file_id, symbol_count) VALUES (2, 1, 1)",
			);

			// Cycle 2: C <-> D
			db.run(
				"INSERT INTO dependencies (from_file_id, to_file_id, symbol_count) VALUES (3, 4, 1)",
			);
			db.run(
				"INSERT INTO dependencies (from_file_id, to_file_id, symbol_count) VALUES (4, 3, 1)",
			);

			const cycles = getCycles(db, 50);

			// Should find at least 2 distinct cycles
			expect(cycles.length).toBeGreaterThanOrEqual(2);

			// Check that we have cycles involving different files
			const cycleStrings = cycles.map((c) => c.files.join(" -> "));
			const hasABCycle = cycleStrings.some(
				(s) => s.includes("a.ts") && s.includes("b.ts"),
			);
			const hasCDCycle = cycleStrings.some(
				(s) => s.includes("c.ts") && s.includes("d.ts"),
			);

			expect(hasABCycle).toBe(true);
			expect(hasCDCycle).toBe(true);
		});
	});

	describe("Limit parameter", () => {
		test("should respect limit parameter", () => {
			db.exec("DELETE FROM dependencies");
			db.exec("DELETE FROM files");

			// Create multiple cycles
			for (let i = 1; i <= 10; i++) {
				db.run(
					"INSERT INTO files (id, path, language, mtime, indexed_at) VALUES (?, ?, 'typescript', 1000, 1000)",
					[i, `file${i}.ts`],
				);
			}

			// Create 5 independent 2-file cycles
			for (let i = 1; i <= 10; i += 2) {
				db.run(
					"INSERT INTO dependencies (from_file_id, to_file_id, symbol_count) VALUES (?, ?, 1)",
					[i, i + 1],
				);
				db.run(
					"INSERT INTO dependencies (from_file_id, to_file_id, symbol_count) VALUES (?, ?, 1)",
					[i + 1, i],
				);
			}

			const cycles = getCycles(db, 3);

			// Should respect limit of 3
			expect(cycles.length).toBeLessThanOrEqual(3);
		});
	});

	describe("Cycle length", () => {
		test("should correctly report cycle length", () => {
			db.exec("DELETE FROM dependencies");
			db.exec("DELETE FROM files");

			db.run(
				"INSERT INTO files (id, path, language, mtime, indexed_at) VALUES (1, 'a.ts', 'typescript', 1000, 1000)",
			);
			db.run(
				"INSERT INTO files (id, path, language, mtime, indexed_at) VALUES (2, 'b.ts', 'typescript', 1000, 1000)",
			);
			db.run(
				"INSERT INTO files (id, path, language, mtime, indexed_at) VALUES (3, 'c.ts', 'typescript', 1000, 1000)",
			);

			// 2-hop cycle: A -> B -> A
			db.run(
				"INSERT INTO dependencies (from_file_id, to_file_id, symbol_count) VALUES (1, 2, 1)",
			);
			db.run(
				"INSERT INTO dependencies (from_file_id, to_file_id, symbol_count) VALUES (2, 1, 1)",
			);

			const cycles = getCycles(db, 50);
			const cycle = cycles[0];

			// Length should be 2 (number of edges in the cycle)
			expect(cycle.length).toBe(2);

			// Files array should have length + 1 elements (includes return to start)
			expect(cycle.files.length).toBe(3);
		});
	});
});
