// Tests for query command - Read-only enforcement via SQLite

import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { query } from "./query.ts";

describe("Query Command - Read-Only Enforcement", () => {
	const testDir = "/tmp/ctx-query-test-" + Date.now();
	const dbPath = join(testDir, ".dora", "dora.db");
	let writeDb: Database;
	let originalCwd: string;

	beforeAll(() => {
		// Save original directory
		originalCwd = process.cwd();

		// Create test directory
		mkdirSync(testDir, { recursive: true });

		// Create .dora directory
		mkdirSync(join(testDir, ".dora"), { recursive: true });

		// Create package.json to mark as repo root
		writeFileSync(
			join(testDir, "package.json"),
			JSON.stringify({ name: "test" }),
		);

		// Create database with write access
		writeDb = new Database(dbPath, { create: true });

		// Create minimal schema and data
		writeDb.exec(`
      CREATE TABLE files (
        id INTEGER PRIMARY KEY,
        path TEXT UNIQUE NOT NULL
      );
      INSERT INTO files (id, path) VALUES (1, 'test.ts');
      INSERT INTO files (id, path) VALUES (2, 'other.ts');
    `);
		writeDb.close();

		// Create config pointing to test database
		writeFileSync(
			join(testDir, ".dora", "config.json"),
			JSON.stringify({
				root: testDir,
				db: ".dora/dora.db",
				scip: ".dora/index.scip",
				lastIndexed: new Date().toISOString(),
			}),
		);

		// Change to test directory so ctx commands find the config
		process.chdir(testDir);
	});

	afterAll(() => {
		// Restore original directory
		process.chdir(originalCwd);

		// Clean up
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("Write operations blocked by SQLite", () => {
		test("should block INSERT via SQLite readonly mode", async () => {
			let error: Error | null = null;
			try {
				await query("INSERT INTO files (id, path) VALUES (3, 'bad.ts')");
			} catch (e) {
				error = e as Error;
			}

			expect(error).not.toBeNull();
			expect(error?.message).toContain("readonly");
		});

		test("should block UPDATE via SQLite readonly mode", async () => {
			let error: Error | null = null;
			try {
				await query("UPDATE files SET path = 'hacked.ts' WHERE id = 1");
			} catch (e) {
				error = e as Error;
			}

			expect(error).not.toBeNull();
			expect(error?.message).toContain("readonly");
		});

		test("should block DELETE via SQLite readonly mode", async () => {
			let error: Error | null = null;
			try {
				await query("DELETE FROM files WHERE id = 1");
			} catch (e) {
				error = e as Error;
			}

			expect(error).not.toBeNull();
			expect(error?.message).toContain("readonly");
		});

		test("should block DROP via SQLite readonly mode", async () => {
			let error: Error | null = null;
			try {
				await query("DROP TABLE files");
			} catch (e) {
				error = e as Error;
			}

			expect(error).not.toBeNull();
			expect(error?.message).toContain("readonly");
		});

		test("should block CREATE via SQLite readonly mode", async () => {
			let error: Error | null = null;
			try {
				await query("CREATE TABLE bad (id INTEGER)");
			} catch (e) {
				error = e as Error;
			}

			expect(error).not.toBeNull();
			expect(error?.message).toContain("readonly");
		});
	});

	describe("Bypass attempts still blocked", () => {
		test("should block with comments before INSERT", async () => {
			let error: Error | null = null;
			try {
				await query(
					"/* bypass comment */ INSERT INTO files (id, path) VALUES (3, 'bad.ts')",
				);
			} catch (e) {
				error = e as Error;
			}

			expect(error).not.toBeNull();
			expect(error?.message).toContain("readonly");
		});

		test("should block CTE with INSERT", async () => {
			let error: Error | null = null;
			try {
				await query(
					"WITH cte AS (SELECT 1) INSERT INTO files (id, path) VALUES (3, 'bad.ts')",
				);
			} catch (e) {
				error = e as Error;
			}

			expect(error).not.toBeNull();
			expect(error?.message).toContain("readonly");
		});
	});

	describe("Valid SELECT queries work", () => {
		test("should execute simple SELECT", async () => {
			let output: any = null;
			const originalLog = console.log;
			console.log = (data: string) => {
				output = JSON.parse(data);
			};

			await query("SELECT * FROM files ORDER BY id");

			console.log = originalLog;

			expect(output).not.toBeNull();
			expect(output.rows).toBeDefined();
			expect(output.row_count).toBe(2);
			expect(output.columns).toContain("path");
			expect(output.rows[0].path).toBe("test.ts");
		});

		test("should execute SELECT with WHERE", async () => {
			let output: any = null;
			const originalLog = console.log;
			console.log = (data: string) => {
				output = JSON.parse(data);
			};

			await query("SELECT path FROM files WHERE id = 2");

			console.log = originalLog;

			expect(output.rows.length).toBe(1);
			expect(output.rows[0].path).toBe("other.ts");
		});

		test("should execute COUNT aggregate", async () => {
			let output: any = null;
			const originalLog = console.log;
			console.log = (data: string) => {
				output = JSON.parse(data);
			};

			await query("SELECT COUNT(*) as count FROM files");

			console.log = originalLog;

			expect(output.rows[0].count).toBe(2);
		});
	});
});

