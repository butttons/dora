// Tests for adventure command - Bidirectional BFS pathfinding

import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getDependencies, getReverseDependencies } from "../../src/db/queries.ts";

describe("Adventure Command - Pathfinding Algorithm", () => {
	let db: Database;

	beforeAll(() => {
		// Create in-memory test database with dependency graph
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

		// Create test dependency graph:
		// A -> B -> C -> D
		//      |    |
		//      v    v
		//      E    F
		// G (isolated)

		const files = [
			{ id: 1, path: "a.ts" },
			{ id: 2, path: "b.ts" },
			{ id: 3, path: "c.ts" },
			{ id: 4, path: "d.ts" },
			{ id: 5, path: "e.ts" },
			{ id: 6, path: "f.ts" },
			{ id: 7, path: "g.ts" }, // isolated
		];

		for (const file of files) {
			db.run(
				"INSERT INTO files (id, path, language, mtime, indexed_at) VALUES (?, ?, 'typescript', 1000, 1000)",
				[file.id, file.path],
			);
		}

		// Create dependencies
		const deps = [
			{ from: 1, to: 2 }, // A -> B
			{ from: 2, to: 3 }, // B -> C
			{ from: 3, to: 4 }, // C -> D
			{ from: 2, to: 5 }, // B -> E
			{ from: 3, to: 6 }, // C -> F
		];

		for (const dep of deps) {
			db.run(
				"INSERT INTO dependencies (from_file_id, to_file_id, symbol_count) VALUES (?, ?, 1)",
				[dep.from, dep.to],
			);
		}
	});

	afterAll(() => {
		db.close();
	});

	describe("Direct dependencies", () => {
		test("should find direct dependency at depth 1", () => {
			const deps = getDependencies(db, "a.ts", 1);

			expect(deps).toHaveLength(1);
			expect(deps[0].path).toBe("b.ts");
			expect(deps[0].depth).toBe(1);
		});

		test("should find multiple direct dependencies", () => {
			const deps = getDependencies(db, "b.ts", 1);

			expect(deps).toHaveLength(2);
			const paths = deps.map((d) => d.path).sort();
			expect(paths).toEqual(["c.ts", "e.ts"]);
		});
	});

	describe("Multi-hop dependencies", () => {
		test("should find dependencies at depth 2", () => {
			const deps = getDependencies(db, "a.ts", 2);

			expect(deps.length).toBeGreaterThanOrEqual(2);
			const depMap = new Map(deps.map((d) => [d.path, d.depth]));

			// Direct: A -> B
			expect(depMap.get("b.ts")).toBe(1);

			// 2-hop: A -> B -> C and A -> B -> E
			expect(depMap.get("c.ts")).toBe(2);
			expect(depMap.get("e.ts")).toBe(2);
		});

		test("should find dependencies at depth 3", () => {
			const deps = getDependencies(db, "a.ts", 3);

			const depMap = new Map(deps.map((d) => [d.path, d.depth]));

			// Should have all reachable nodes
			expect(depMap.get("b.ts")).toBe(1);
			expect(depMap.get("c.ts")).toBe(2);
			expect(depMap.get("e.ts")).toBe(2);
			expect(depMap.get("d.ts")).toBe(3);
			expect(depMap.get("f.ts")).toBe(3);
		});
	});

	describe("Reverse dependencies", () => {
		test("should find direct reverse dependency", () => {
			const rdeps = getReverseDependencies(db, "b.ts", 1);

			expect(rdeps).toHaveLength(1);
			expect(rdeps[0].path).toBe("a.ts");
			expect(rdeps[0].depth).toBe(1);
		});

		test("should find multi-hop reverse dependencies", () => {
			const rdeps = getReverseDependencies(db, "c.ts", 2);

			const depMap = new Map(rdeps.map((d) => [d.path, d.depth]));

			// Direct: B -> C
			expect(depMap.get("b.ts")).toBe(1);

			// 2-hop: A -> B -> C
			expect(depMap.get("a.ts")).toBe(2);
		});
	});

	describe("Isolated nodes", () => {
		test("should return empty for isolated node dependencies", () => {
			const deps = getDependencies(db, "g.ts", 5);

			expect(deps).toHaveLength(0);
		});

		test("should return empty for isolated node reverse deps", () => {
			const rdeps = getReverseDependencies(db, "g.ts", 5);

			expect(rdeps).toHaveLength(0);
		});
	});

	describe("Leaf nodes", () => {
		test("should return empty for leaf node (no outgoing deps)", () => {
			const deps = getDependencies(db, "d.ts", 2);

			expect(deps).toHaveLength(0);
		});

		test("should find reverse deps for leaf node", () => {
			const rdeps = getReverseDependencies(db, "d.ts", 3);

			expect(rdeps.length).toBeGreaterThan(0);
			const depMap = new Map(rdeps.map((d) => [d.path, d.depth]));

			// D is reachable from C -> B -> A
			expect(depMap.get("c.ts")).toBe(1);
			expect(depMap.get("b.ts")).toBe(2);
			expect(depMap.get("a.ts")).toBe(3);
		});
	});

	describe("Depth limiting", () => {
		test("should respect depth limit", () => {
			const deps = getDependencies(db, "a.ts", 1);

			// Should only get direct dependency (B), not transitive ones
			expect(deps).toHaveLength(1);
			expect(deps[0].path).toBe("b.ts");

			// Should not include C, D, E, F
			const paths = deps.map((d) => d.path);
			expect(paths).not.toContain("c.ts");
			expect(paths).not.toContain("d.ts");
		});

		test("should find shortest path (min depth) when multiple paths exist", () => {
			// Both B and C depend on different files, but B is closer
			const deps = getDependencies(db, "a.ts", 2);

			const depMap = new Map(deps.map((d) => [d.path, d.depth]));

			// B should be at depth 1 (shortest)
			expect(depMap.get("b.ts")).toBe(1);

			// C should be at depth 2 (A -> B -> C)
			expect(depMap.get("c.ts")).toBe(2);
		});
	});
});
