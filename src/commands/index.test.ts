// Tests for ctx index command

import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync } from "fs";
import { join } from "path";
import { convertToDatabase } from "../converter/convert.ts";

describe("index command - database conversion", () => {
	const projectRoot = process.cwd();
	const existingDbPath = join(projectRoot, ".ctx", "dora.db");

	// These tests verify the database structure created by the index command
	// They use the existing ctx-cli database for verification

	test("should create database with correct schema", () => {
		// Skip if database doesn't exist
		if (!existsSync(existingDbPath)) {
			console.log("Skipping test: .dora/dora.db not found. Run 'ctx index' first.");
			return;
		}

		const db = new Database(existingDbPath, { readonly: true });

		// Check tables exist
		const tables = db
			.query("SELECT name FROM sqlite_master WHERE type='table'")
			.all() as Array<{ name: string }>;
		const tableNames = tables.map((t) => t.name);

		expect(tableNames).toContain("files");
		expect(tableNames).toContain("symbols");
		expect(tableNames).toContain("dependencies");
		expect(tableNames).toContain("symbol_references");
		expect(tableNames).toContain("packages");
		expect(tableNames).toContain("metadata");

		db.close();
	});

	test("should have files table with correct columns", () => {
		if (!existsSync(existingDbPath)) {
			console.log("Skipping test: .dora/dora.db not found");
			return;
		}

		const db = new Database(existingDbPath, { readonly: true });

		const filesColumns = db
			.query("PRAGMA table_info(files)")
			.all() as Array<{ name: string }>;
		const filesColumnNames = filesColumns.map((c) => c.name);

		expect(filesColumnNames).toContain("id");
		expect(filesColumnNames).toContain("path");
		expect(filesColumnNames).toContain("language");
		expect(filesColumnNames).toContain("mtime");
		expect(filesColumnNames).toContain("symbol_count");
		expect(filesColumnNames).toContain("dependency_count");
		expect(filesColumnNames).toContain("dependent_count");
		expect(filesColumnNames).toContain("indexed_at");

		db.close();
	});

	test("should have symbols table with correct columns", () => {
		if (!existsSync(existingDbPath)) {
			console.log("Skipping test: .dora/dora.db not found");
			return;
		}

		const db = new Database(existingDbPath, { readonly: true });

		const symbolsColumns = db
			.query("PRAGMA table_info(symbols)")
			.all() as Array<{ name: string }>;
		const symbolsColumnNames = symbolsColumns.map((c) => c.name);

		expect(symbolsColumnNames).toContain("id");
		expect(symbolsColumnNames).toContain("file_id");
		expect(symbolsColumnNames).toContain("name");
		expect(symbolsColumnNames).toContain("scip_symbol");
		expect(symbolsColumnNames).toContain("kind");
		expect(symbolsColumnNames).toContain("start_line");
		expect(symbolsColumnNames).toContain("end_line");
		expect(symbolsColumnNames).toContain("start_char");
		expect(symbolsColumnNames).toContain("end_char");
		expect(symbolsColumnNames).toContain("is_local");
		expect(symbolsColumnNames).toContain("reference_count");

		db.close();
	});

	test("should populate denormalized fields correctly", () => {
		if (!existsSync(existingDbPath)) {
			console.log("Skipping test: .dora/dora.db not found");
			return;
		}

		const db = new Database(existingDbPath, { readonly: true });

		// Check that denormalized fields are populated
		const filesWithCounts = db
			.query(
				"SELECT symbol_count, dependency_count, dependent_count FROM files WHERE symbol_count > 0 LIMIT 10",
			)
			.all() as Array<{
			symbol_count: number;
			dependency_count: number;
			dependent_count: number;
		}>;

		// Should have at least some files with counts
		expect(filesWithCounts.length).toBeGreaterThan(0);

		// All counts should be non-negative
		for (const file of filesWithCounts) {
			expect(file.symbol_count).toBeGreaterThanOrEqual(0);
			expect(file.dependency_count).toBeGreaterThanOrEqual(0);
			expect(file.dependent_count).toBeGreaterThanOrEqual(0);
		}

		db.close();
	});

	test("should populate symbol kinds correctly", () => {
		if (!existsSync(existingDbPath)) {
			console.log("Skipping test: .dora/dora.db not found");
			return;
		}

		const db = new Database(existingDbPath, { readonly: true });

		// Check that symbols have kinds
		const symbolsWithKind = db
			.query("SELECT kind FROM symbols WHERE kind != 'unknown' LIMIT 20")
			.all() as Array<{ kind: string }>;

		// Should have at least some symbols with kinds
		expect(symbolsWithKind.length).toBeGreaterThan(0);

		// Kinds should be valid strings
		const validKinds = [
			"class",
			"interface",
			"type",
			"function",
			"method",
			"property",
			"parameter",
			"variable",
			"enum",
			"module",
			"namespace",
			"constant",
			"constructor",
			"enum_member",
		];

		for (const sym of symbolsWithKind) {
			expect(validKinds).toContain(sym.kind);
		}

		db.close();
	});

	test("should filter local symbols correctly", () => {
		if (!existsSync(existingDbPath)) {
			console.log("Skipping test: .dora/dora.db not found");
			return;
		}

		const db = new Database(existingDbPath, { readonly: true });

		const nonLocalSymbols = db
			.query("SELECT COUNT(*) as count FROM symbols WHERE is_local = 0")
			.get() as { count: number };

		// Should have non-local symbols
		expect(nonLocalSymbols.count).toBeGreaterThan(0);

		db.close();
	});

	test("should populate metadata table", () => {
		if (!existsSync(existingDbPath)) {
			console.log("Skipping test: .dora/dora.db not found");
			return;
		}

		const db = new Database(existingDbPath, { readonly: true });

		const metadata = db
			.query("SELECT key, value FROM metadata")
			.all() as Array<{ key: string; value: string }>;
		const metadataObj = Object.fromEntries(
			metadata.map((m) => [m.key, m.value]),
		);

		expect(metadataObj).toHaveProperty("last_indexed");
		expect(metadataObj).toHaveProperty("total_files");
		expect(metadataObj).toHaveProperty("total_symbols");

		// Verify metadata values match actual counts
		const fileCount = (
			db.query("SELECT COUNT(*) as count FROM files").get() as {
				count: number;
			}
		).count;
		const symbolCount = (
			db.query("SELECT COUNT(*) as count FROM symbols").get() as {
				count: number;
			}
		).count;

		expect(metadataObj.total_files).toBe(fileCount.toString());
		expect(metadataObj.total_symbols).toBe(symbolCount.toString());

		db.close();
	});

	test("should have dependencies table populated", () => {
		if (!existsSync(existingDbPath)) {
			console.log("Skipping test: .dora/dora.db not found");
			return;
		}

		const db = new Database(existingDbPath, { readonly: true });

		// Check that dependencies table has data
		const depsCount = (
			db.query("SELECT COUNT(*) as count FROM dependencies").get() as {
				count: number;
			}
		).count;

		// Should have at least some dependencies
		expect(depsCount).toBeGreaterThan(0);

		// Check that dependencies have symbol information
		const depsWithSymbols = db
			.query(
				"SELECT COUNT(*) as count FROM dependencies WHERE symbols IS NOT NULL AND symbols != '[]'",
			)
			.get() as { count: number };

		expect(depsWithSymbols.count).toBeGreaterThan(0);

		db.close();
	});
});
