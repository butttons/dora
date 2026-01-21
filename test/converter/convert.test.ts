import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { convertToDatabase } from "../../src/converter/convert.ts";

describe("Database Converter", () => {
	const testDir = join(process.cwd(), "test", "fixtures");
	const scipPath = join(testDir, "index.scip");
	const testDbDir = join(process.cwd(), ".test-db");
	const dbPath = join(testDbDir, "test.db");

	const skipTests = !existsSync(scipPath);

	beforeEach(() => {
		if (!existsSync(testDbDir)) {
			mkdirSync(testDbDir, { recursive: true });
		}
	});

	afterEach(() => {
		if (existsSync(testDbDir)) {
			rmSync(testDbDir, { recursive: true, force: true });
		}
	});

	test("should convert SCIP to database successfully", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		const stats = await convertToDatabase(scipPath, dbPath, testDir);

		expect(stats).toBeDefined();
		expect(stats.mode).toBeDefined();
		expect(stats.total_files).toBeGreaterThan(0);
		expect(stats.total_symbols).toBeGreaterThan(0);
		expect(stats.time_ms).toBeGreaterThan(0);

		expect(existsSync(dbPath)).toBe(true);
	});

	test("should create database with correct schema", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		await convertToDatabase(scipPath, dbPath, testDir);

		const db = new Database(dbPath);

		const tables = db
			.query(
				"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
			)
			.all() as Array<{ name: string }>;

		const tableNames = tables.map((t) => t.name);

		expect(tableNames).toContain("files");
		expect(tableNames).toContain("symbols");
		expect(tableNames).toContain("dependencies");
		expect(tableNames).toContain("symbol_references");
		expect(tableNames).toContain("packages");
		expect(tableNames).toContain("metadata");
		expect(tableNames).toContain("documents");

		db.close();
	});

	test("should insert files without duplicates", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		await convertToDatabase(scipPath, dbPath, testDir);

		const db = new Database(dbPath);

		const files = db.query("SELECT path FROM files ORDER BY path").all() as Array<{
			path: string;
		}>;

		const paths = files.map((f) => f.path);
		const uniquePaths = new Set(paths);

		expect(paths.length).toBe(uniquePaths.size);

		db.close();
	});

	test("should handle symbols correctly", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		await convertToDatabase(scipPath, dbPath, testDir);

		const db = new Database(dbPath);

		const symbols = db
			.query("SELECT id, file_id, name, kind FROM symbols LIMIT 10")
			.all() as Array<{
			id: number;
			file_id: number;
			name: string;
			kind: string;
		}>;

		expect(symbols.length).toBeGreaterThan(0);

		for (const sym of symbols) {
			expect(sym.id).toBeGreaterThan(0);
			expect(sym.file_id).toBeGreaterThan(0);
			expect(typeof sym.name).toBe("string");
			expect(typeof sym.kind).toBe("string");
		}

		db.close();
	});

	test("should handle dependencies correctly", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		await convertToDatabase(scipPath, dbPath, testDir);

		const db = new Database(dbPath);

		const deps = db
			.query(
				"SELECT from_file_id, to_file_id, symbol_count FROM dependencies LIMIT 10",
			)
			.all() as Array<{
			from_file_id: number;
			to_file_id: number;
			symbol_count: number;
		}>;

		for (const dep of deps) {
			expect(dep.from_file_id).toBeGreaterThan(0);
			expect(dep.to_file_id).toBeGreaterThan(0);
			expect(dep.symbol_count).toBeGreaterThan(0);
			expect(dep.from_file_id).not.toBe(dep.to_file_id);
		}

		db.close();
	});

	test("should update denormalized fields correctly", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		await convertToDatabase(scipPath, dbPath, testDir);

		const db = new Database(dbPath);

		const files = db
			.query(
				"SELECT id, path, symbol_count, dependency_count, dependent_count FROM files",
			)
			.all() as Array<{
			id: number;
			path: string;
			symbol_count: number;
			dependency_count: number;
			dependent_count: number;
		}>;

		for (const file of files) {
			const actualSymbolCount = (
				db
					.query("SELECT COUNT(*) as c FROM symbols WHERE file_id = ?")
					.get(file.id) as { c: number }
			).c;
			expect(file.symbol_count).toBe(actualSymbolCount);

			const actualDependencyCount = (
				db
					.query(
						"SELECT COUNT(DISTINCT to_file_id) as c FROM dependencies WHERE from_file_id = ?",
					)
					.get(file.id) as { c: number }
			).c;
			expect(file.dependency_count).toBe(actualDependencyCount);

			const actualDependentCount = (
				db
					.query(
						"SELECT COUNT(DISTINCT from_file_id) as c FROM dependencies WHERE to_file_id = ?",
					)
					.get(file.id) as { c: number }
			).c;
			expect(file.dependent_count).toBe(actualDependentCount);
		}

		db.close();
	});

	test("should handle incremental builds", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		const stats1 = await convertToDatabase(scipPath, dbPath, testDir);
		expect(stats1.mode).toBe("full");

		await Bun.sleep(100);

		const stats2 = await convertToDatabase(scipPath, dbPath, testDir);
		expect(stats2.mode).toBe("incremental");
		expect(stats2.changed_files).toBe(0);
		expect(stats2.deleted_files).toBe(0);
	});

	test("should force full rebuild with force option", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		const stats1 = await convertToDatabase(scipPath, dbPath, testDir);
		expect(stats1.mode).toBe("full");

		await Bun.sleep(100);

		const stats2 = await convertToDatabase(scipPath, dbPath, testDir, {
			force: true,
		});
		expect(stats2.mode).toBe("full");
	});

	test("should handle symbol references correctly", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		await convertToDatabase(scipPath, dbPath, testDir);

		const db = new Database(dbPath);

		const refs = db
			.query(
				"SELECT symbol_id, file_id, line FROM symbol_references LIMIT 10",
			)
			.all() as Array<{
			symbol_id: number;
			file_id: number;
			line: number;
		}>;

		for (const ref of refs) {
			expect(ref.symbol_id).toBeGreaterThan(0);
			expect(ref.file_id).toBeGreaterThan(0);
			expect(ref.line).toBeGreaterThanOrEqual(0);

			const symbol = db
				.query("SELECT id FROM symbols WHERE id = ?")
				.get(ref.symbol_id) as { id: number } | undefined;
			expect(symbol).toBeDefined();

			const file = db
				.query("SELECT id FROM files WHERE id = ?")
				.get(ref.file_id) as { id: number } | undefined;
			expect(file).toBeDefined();
		}

		db.close();
	});

	test("should filter local symbols correctly", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		await convertToDatabase(scipPath, dbPath, testDir);

		const db = new Database(dbPath);

		const localSymbols = db
			.query("SELECT name, scip_symbol FROM symbols WHERE is_local = 1 LIMIT 10")
			.all() as Array<{
			name: string;
			scip_symbol: string;
		}>;

		for (const sym of localSymbols) {
			expect(sym.scip_symbol).toContain("local");
		}

		db.close();
	});

	test("should handle packages correctly", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		await convertToDatabase(scipPath, dbPath, testDir);

		const db = new Database(dbPath);

		const packages = db
			.query("SELECT name, manager, symbol_count FROM packages")
			.all() as Array<{
			name: string;
			manager: string;
			symbol_count: number;
		}>;

		for (const pkg of packages) {
			expect(typeof pkg.name).toBe("string");
			expect(pkg.name.length).toBeGreaterThan(0);
			expect(pkg.manager).toBe("npm");
			expect(pkg.symbol_count).toBeGreaterThan(0);
		}

		db.close();
	});

	test("should store metadata correctly", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		await convertToDatabase(scipPath, dbPath, testDir);

		const db = new Database(dbPath);

		const metadata = db
			.query("SELECT key, value FROM metadata")
			.all() as Array<{
			key: string;
			value: string;
		}>;

		const metadataMap = new Map(metadata.map((m) => [m.key, m.value]));

		expect(metadataMap.has("last_indexed")).toBe(true);
		expect(metadataMap.has("total_files")).toBe(true);
		expect(metadataMap.has("total_symbols")).toBe(true);

		const totalFiles = Number.parseInt(metadataMap.get("total_files") || "0");
		const totalSymbols = Number.parseInt(
			metadataMap.get("total_symbols") || "0",
		);

		expect(totalFiles).toBeGreaterThan(0);
		expect(totalSymbols).toBeGreaterThan(0);

		db.close();
	});
});
