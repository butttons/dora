import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { convertToDatabase } from "../../src/converter/convert.ts";

describe("Batch Processing - Duplicate File Paths", () => {
	const testDir = join(process.cwd(), ".test-batch-regression");
	const scipPath = join(process.cwd(), "test", "fixtures", "index.scip");
	const dbPath = join(testDir, "test.db");
	const repoRoot = join(process.cwd(), "test", "fixtures");

	const skipTests = !existsSync(scipPath);

	beforeEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	test("should not create duplicate files in database", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		await convertToDatabase(scipPath, dbPath, repoRoot);

		const db = new Database(dbPath);

		const files = db.query("SELECT path FROM files").all() as Array<{
			path: string;
		}>;

		const paths = files.map((f) => f.path);
		const uniquePaths = new Set(paths);

		expect(paths.length).toBe(uniquePaths.size);

		for (const path of paths) {
			const count = paths.filter((p) => p === path).length;
			if (count > 1) {
				throw new Error(`Duplicate file path found: ${path} (${count} times)`);
			}
		}

		db.close();
	});

	test("should handle batch processing correctly", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		const stats = await convertToDatabase(scipPath, dbPath, repoRoot);

		expect(stats.mode).toBe("full");
		expect(stats.total_files).toBeGreaterThan(0);

		const db = new Database(dbPath);

		const duplicateCheck = db
			.query(
				`
				SELECT path, COUNT(*) as count
				FROM files
				GROUP BY path
				HAVING COUNT(*) > 1
			`,
			)
			.all() as Array<{
			path: string;
			count: number;
		}>;

		expect(duplicateCheck.length).toBe(0);

		db.close();
	});

	test("should maintain UNIQUE constraint on files.path", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		await convertToDatabase(scipPath, dbPath, repoRoot);

		const db = new Database(dbPath);

		const indexes = db
			.query(
				`
				SELECT sql
				FROM sqlite_master
				WHERE type='table' AND name='files'
			`,
			)
			.all() as Array<{
			sql: string;
		}>;

		expect(indexes.length).toBeGreaterThan(0);
		expect(indexes[0].sql).toContain("UNIQUE");

		db.close();
	});

	test("should handle full rebuild without errors", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		let error: Error | null = null;
		try {
			await convertToDatabase(scipPath, dbPath, repoRoot, { force: true });
		} catch (e) {
			error = e as Error;
		}

		expect(error).toBeNull();

		const db = new Database(dbPath);

		const files = db.query("SELECT COUNT(*) as c FROM files").get() as {
			c: number;
		};
		expect(files.c).toBeGreaterThan(0);

		const duplicates = db
			.query(
				`
				SELECT path, COUNT(*) as count
				FROM files
				GROUP BY path
				HAVING COUNT(*) > 1
			`,
			)
			.all() as Array<{
			path: string;
			count: number;
		}>;

		expect(duplicates.length).toBe(0);

		db.close();
	});

	test("should properly track inserted files across batches", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		await convertToDatabase(scipPath, dbPath, repoRoot);

		const db = new Database(dbPath);

		const fileIdCheck = db
			.query(
				`
				SELECT f.id, f.path, COUNT(s.id) as symbol_count
				FROM files f
				LEFT JOIN symbols s ON s.file_id = f.id
				GROUP BY f.id
			`,
			)
			.all() as Array<{
			id: number;
			path: string;
			symbol_count: number;
		}>;

		for (const file of fileIdCheck) {
			expect(file.id).toBeGreaterThan(0);
			expect(typeof file.path).toBe("string");
			expect(file.symbol_count).toBeGreaterThanOrEqual(0);
		}

		const orphanedSymbols = db
			.query(
				`
				SELECT COUNT(*) as c
				FROM symbols s
				WHERE NOT EXISTS (SELECT 1 FROM files f WHERE f.id = s.file_id)
			`,
			)
			.get() as { c: number };

		expect(orphanedSymbols.c).toBe(0);

		db.close();
	});

	test("regression: UNIQUE constraint should not fail on first run", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		let uniqueConstraintError = false;
		try {
			await convertToDatabase(scipPath, dbPath, repoRoot);
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("UNIQUE constraint failed")
			) {
				uniqueConstraintError = true;
			}
			throw error;
		}

		expect(uniqueConstraintError).toBe(false);

		const db = new Database(dbPath);
		const fileCount = (
			db.query("SELECT COUNT(*) as c FROM files").get() as { c: number }
		).c;
		expect(fileCount).toBeGreaterThan(0);
		db.close();
	});
});
