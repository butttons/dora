// Integration tests for commands

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { init } from "../../src/commands/init.ts";
import { status } from "../../src/commands/status.ts";

// Mock console.log to capture output
let capturedOutput: any = null;
const originalLog = console.log;

function captureOutput() {
	capturedOutput = null;
	console.log = (data: string) => {
		try {
			capturedOutput = JSON.parse(data);
		} catch {
			capturedOutput = data;
		}
	};
}

function restoreOutput() {
	console.log = originalLog;
}

describe("Commands Integration Tests", () => {
	const testDir = "/tmp/ctx-test-" + Date.now();
	const originalCwd = process.cwd();

	beforeAll(() => {
		// Create test directory with a package.json to make it a repo root
		mkdirSync(testDir, { recursive: true });
		writeFileSync(
			join(testDir, "package.json"),
			JSON.stringify({ name: "test" }),
		);

		// Change to test directory
		process.chdir(testDir);
	});

	afterAll(() => {
		// Restore original directory
		process.chdir(originalCwd);

		// Clean up test directory
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe("init command", () => {
		test("should initialize .dora directory and config", async () => {
			captureOutput();
			await init();
			restoreOutput();

			// Check output
			expect(capturedOutput).toHaveProperty("success", true);
			expect(capturedOutput).toHaveProperty("root");
			expect(capturedOutput).toHaveProperty("message");

			// Check .dora directory exists
			expect(existsSync(join(testDir, ".dora"))).toBe(true);

			// Check config.json exists
			const configPath = join(testDir, ".dora", "config.json");
			expect(existsSync(configPath)).toBe(true);

			// Check .gitignore was updated
			const gitignorePath = join(testDir, ".gitignore");
			if (existsSync(gitignorePath)) {
				const content = await Bun.file(gitignorePath).text();
				expect(content).toContain(".dora");
			}
		});

		test("should fail if already initialized", async () => {
			captureOutput();

			let error: Error | null = null;
			try {
				await init();
			} catch (e) {
				error = e as Error;
			}
			restoreOutput();

			expect(error).not.toBeNull();
			expect(error?.message).toContain("already initialized");
		});
	});

	describe("status command", () => {
		test("should show initialized but not indexed", async () => {
			captureOutput();
			await status();
			restoreOutput();

			expect(capturedOutput).toHaveProperty("initialized", true);
			expect(capturedOutput).toHaveProperty("indexed", false);
		});
	});

	// Note: Commands that require database access are tested in the database queries test file
	// to avoid database I/O issues when copying files in test environment
});

// Additional tests using the existing project database
describe("Query Commands - Integration Tests", () => {
	const projectRoot = process.cwd();
	const existingDbPath = join(projectRoot, ".dora", "dora.db");
	const originalCwd = process.cwd();

	// These tests use the existing ctx-cli database
	const skipTests = !existsSync(existingDbPath);

	beforeAll(() => {
		if (!skipTests) {
			// Change to project root to use existing database
			process.chdir(projectRoot);
		}
	});

	afterAll(() => {
		process.chdir(originalCwd);
	});

	test("map command - should return codebase statistics", async () => {
		if (skipTests) {
			console.log("Skipping test: .dora/dora.db not found");
			return;
		}

		const { map } = await import("../../src/commands/map.ts");

		captureOutput();
		await map();
		restoreOutput();

		expect(capturedOutput).toHaveProperty("file_count");
		expect(capturedOutput).toHaveProperty("symbol_count");
		expect(capturedOutput.file_count).toBeGreaterThan(0);
		expect(capturedOutput.symbol_count).toBeGreaterThan(0);
	});

	test("symbol command - should find symbols by name", async () => {
		if (skipTests) {
			console.log("Skipping test: .dora/dora.db not found");
			return;
		}

		const { symbol } = await import("../../src/commands/symbol.ts");

		captureOutput();
		await symbol("index", {});
		restoreOutput();

		expect(capturedOutput).toHaveProperty("query", "index");
		expect(capturedOutput).toHaveProperty("results");
		expect(Array.isArray(capturedOutput.results)).toBe(true);

		if (capturedOutput.results.length > 0) {
			const result = capturedOutput.results[0];
			expect(result).toHaveProperty("name");
			expect(result).toHaveProperty("kind");
			expect(result).toHaveProperty("path");
			expect(result).toHaveProperty("lines");
		}
	});

	test("file command - should show file details", async () => {
		if (skipTests) {
			console.log("Skipping test: .dora/dora.db not found");
			return;
		}

		const { file } = await import("../../src/commands/file.ts");

		// Use a file we know exists in the project
		const testFile = "src/index.ts";

		captureOutput();
		await file(testFile);
		restoreOutput();

		expect(capturedOutput).toHaveProperty("path", testFile);
		expect(capturedOutput).toHaveProperty("symbols");
		expect(capturedOutput).toHaveProperty("depends_on");
		expect(capturedOutput).toHaveProperty("depended_by");
		expect(Array.isArray(capturedOutput.symbols)).toBe(true);
		expect(Array.isArray(capturedOutput.depends_on)).toBe(true);
		expect(Array.isArray(capturedOutput.depended_by)).toBe(true);
	});

	test("deps command - should show dependencies", async () => {
		if (skipTests) {
			console.log("Skipping test: .dora/dora.db not found");
			return;
		}

		const { deps } = await import("../../src/commands/deps.ts");

		// Use a file we know exists
		const testFile = "src/index.ts";

		captureOutput();
		await deps(testFile, { depth: 1 });
		restoreOutput();

		expect(capturedOutput).toHaveProperty("path", testFile);
		expect(capturedOutput).toHaveProperty("depth", 1);
		expect(capturedOutput).toHaveProperty("dependencies");
		expect(Array.isArray(capturedOutput.dependencies)).toBe(true);

		// Should have some dependencies
		if (capturedOutput.dependencies.length > 0) {
			const dep = capturedOutput.dependencies[0];
			expect(dep).toHaveProperty("path");
			expect(dep).toHaveProperty("depth");
		}
	});

	test("rdeps command - should show reverse dependencies", async () => {
		if (skipTests) {
			console.log("Skipping test: .dora/dora.db not found");
			return;
		}

		const { rdeps } = await import("../../src/commands/rdeps.ts");

		// Use a commonly imported file
		const testFile = "src/utils/config.ts";

		captureOutput();
		await rdeps(testFile, { depth: 1 });
		restoreOutput();

		expect(capturedOutput).toHaveProperty("path", testFile);
		expect(capturedOutput).toHaveProperty("depth", 1);
		expect(capturedOutput).toHaveProperty("dependents");
		expect(Array.isArray(capturedOutput.dependents)).toBe(true);

		// Config file should have dependents
		expect(capturedOutput.dependents.length).toBeGreaterThan(0);
	});

	test("cycles command - should detect circular dependencies", async () => {
		if (skipTests) {
			console.log("Skipping test: .dora/dora.db not found");
			return;
		}

		const { cycles } = await import("../../src/commands/cycles.ts");

		captureOutput();
		await cycles({ limit: 10 });
		restoreOutput();

		expect(capturedOutput).toHaveProperty("cycles");
		expect(Array.isArray(capturedOutput.cycles)).toBe(true);

		// Cycles might be empty (which is good!) or have some entries
		if (capturedOutput.cycles.length > 0) {
			const cycle = capturedOutput.cycles[0];
			expect(cycle).toHaveProperty("files");
			expect(Array.isArray(cycle.files)).toBe(true);
			expect(cycle.files.length).toBe(2); // 2-node cycles only
		}
	});

	test("treasure command - should find most referenced files", async () => {
		if (skipTests) {
			console.log("Skipping test: .dora/dora.db not found");
			return;
		}

		const { treasure } = await import("../../src/commands/treasure.ts");

		captureOutput();
		await treasure({ limit: 5 });
		restoreOutput();

		expect(capturedOutput).toHaveProperty("most_referenced");
		expect(capturedOutput).toHaveProperty("most_dependencies");
		expect(Array.isArray(capturedOutput.most_referenced)).toBe(true);
		expect(Array.isArray(capturedOutput.most_dependencies)).toBe(true);

		if (capturedOutput.most_referenced.length > 0) {
			const hotspot = capturedOutput.most_referenced[0];
			expect(hotspot).toHaveProperty("file");
			expect(hotspot).toHaveProperty("count");
			expect(hotspot.count).toBeGreaterThan(0);
		}
	});

	test("lost command - should find potentially unused symbols", async () => {
		if (skipTests) {
			console.log("Skipping test: .dora/dora.db not found");
			return;
		}

		const { lost } = await import("../../src/commands/lost.ts");

		captureOutput();
		await lost({ limit: 10 });
		restoreOutput();

		expect(capturedOutput).toHaveProperty("unused");
		expect(Array.isArray(capturedOutput.unused)).toBe(true);

		// May or may not have unused symbols - both are valid
		if (capturedOutput.unused.length > 0) {
			const unusedSym = capturedOutput.unused[0];
			expect(unusedSym).toHaveProperty("name");
			expect(unusedSym).toHaveProperty("kind");
			expect(unusedSym).toHaveProperty("file");
			expect(unusedSym).toHaveProperty("lines");
		}
	});
});
