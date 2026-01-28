// Integration tests for commands

import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	test,
} from "bun:test";
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
			const result = await init();

			// Check output
			expect(result).toHaveProperty("success", true);
			expect(result).toHaveProperty("root");
			expect(result).toHaveProperty("message");

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

	describe("init command with language flag", () => {
		const langTestDir = "/tmp/ctx-lang-test-" + Date.now();
		let savedCwd: string;

		beforeAll(() => {
			savedCwd = process.cwd();
			mkdirSync(langTestDir, { recursive: true });
		});

		afterEach(() => {
			process.chdir(savedCwd);
			if (existsSync(join(langTestDir, ".dora"))) {
				rmSync(join(langTestDir, ".dora"), { recursive: true, force: true });
			}
		});

		afterAll(() => {
			process.chdir(savedCwd);
			if (existsSync(langTestDir)) {
				rmSync(langTestDir, { recursive: true, force: true });
			}
		});

		test("should initialize with explicit python language", async () => {
			process.chdir(langTestDir);

			const result = await init({ language: "python" });

			expect(result).toHaveProperty("success", true);

			const configPath = join(langTestDir, ".dora", "config.json");
			const config = JSON.parse(await Bun.file(configPath).text());

			expect(config.language).toBe("python");
			expect(config.commands.index).toBe(
				"scip-python index --output .dora/index.scip",
			);
		});

		test("should initialize with explicit rust language", async () => {
			process.chdir(langTestDir);

			const result = await init({ language: "rust" });

			expect(result).toHaveProperty("success", true);

			const configPath = join(langTestDir, ".dora", "config.json");
			const config = JSON.parse(await Bun.file(configPath).text());

			expect(config.language).toBe("rust");
			expect(config.commands.index).toBe(
				"rust-analyzer scip . --output .dora/index.scip",
			);
		});

		test("should fail with invalid language", async () => {
			process.chdir(langTestDir);

			let error: Error | null = null;
			try {
				await init({ language: "invalid" as any });
			} catch (e) {
				error = e as Error;
			}

			expect(error).not.toBeNull();
			expect(error?.message).toContain("Invalid language");
			expect(error?.message).toContain("invalid");
		});
	});

	describe("status command", () => {
		test("should show initialized but not indexed", async () => {
			const result = await status();

			expect(result).toHaveProperty("initialized", true);
			expect(result).toHaveProperty("indexed", false);
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

		const result = await map();

		expect(result).toHaveProperty("file_count");
		expect(result).toHaveProperty("symbol_count");
		expect(result.file_count).toBeGreaterThan(0);
		expect(result.symbol_count).toBeGreaterThan(0);
	});

	test("symbol command - should find symbols by name", async () => {
		if (skipTests) {
			console.log("Skipping test: .dora/dora.db not found");
			return;
		}

		const { symbol } = await import("../../src/commands/symbol.ts");

		const result = await symbol("index", {});

		expect(result).toHaveProperty("query", "index");
		expect(result).toHaveProperty("results");
		expect(Array.isArray(result.results)).toBe(true);

		if (result.results.length > 0) {
			const firstResult = result.results[0];
			expect(firstResult).toHaveProperty("name");
			expect(firstResult).toHaveProperty("kind");
			expect(firstResult).toHaveProperty("path");
			expect(firstResult).toHaveProperty("lines");
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

		const result = await file(testFile);

		expect(result).toHaveProperty("path", testFile);
		expect(result).toHaveProperty("symbols");
		expect(result).toHaveProperty("depends_on");
		expect(result).toHaveProperty("depended_by");
		expect(Array.isArray(result.symbols)).toBe(true);
		expect(Array.isArray(result.depends_on)).toBe(true);
		expect(Array.isArray(result.depended_by)).toBe(true);
	});

	test("deps command - should show dependencies", async () => {
		if (skipTests) {
			console.log("Skipping test: .dora/dora.db not found");
			return;
		}

		const { deps } = await import("../../src/commands/deps.ts");

		// Use a file we know exists
		const testFile = "src/index.ts";

		const result = await deps(testFile, { depth: 1 });

		expect(result).toHaveProperty("path", testFile);
		expect(result).toHaveProperty("depth", 1);
		expect(result).toHaveProperty("dependencies");
		expect(Array.isArray(result.dependencies)).toBe(true);

		// Should have some dependencies
		if (result.dependencies.length > 0) {
			const dep = result.dependencies[0];
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

		const result = await rdeps(testFile, { depth: 1 });

		expect(result).toHaveProperty("path", testFile);
		expect(result).toHaveProperty("depth", 1);
		expect(result).toHaveProperty("dependents");
		expect(Array.isArray(result.dependents)).toBe(true);

		// Config file should have dependents
		expect(result.dependents.length).toBeGreaterThan(0);
	});

	test("cycles command - should detect circular dependencies", async () => {
		if (skipTests) {
			console.log("Skipping test: .dora/dora.db not found");
			return;
		}

		const { cycles } = await import("../../src/commands/cycles.ts");

		const result = await cycles({ limit: 10 });

		expect(result).toHaveProperty("cycles");
		expect(Array.isArray(result.cycles)).toBe(true);

		// Cycles might be empty (which is good!) or have some entries
		if (result.cycles.length > 0) {
			const cycle = result.cycles[0];
			expect(cycle).toHaveProperty("files");
			expect(Array.isArray(cycle.files)).toBe(true);
			expect(cycle.length).toBe(2); // 2-node cycles only
		}
	});

	test("treasure command - should find most referenced files", async () => {
		if (skipTests) {
			console.log("Skipping test: .dora/dora.db not found");
			return;
		}

		const { treasure } = await import("../../src/commands/treasure.ts");

		const result = await treasure({ limit: 5 });

		expect(result).toHaveProperty("most_referenced");
		expect(result).toHaveProperty("most_dependencies");
		expect(Array.isArray(result.most_referenced)).toBe(true);
		expect(Array.isArray(result.most_dependencies)).toBe(true);

		if (result.most_referenced.length > 0) {
			const hotspot = result.most_referenced[0];
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

		const result = await lost({ limit: 10 });

		expect(result).toHaveProperty("unused");
		expect(Array.isArray(result.unused)).toBe(true);

		// May or may not have unused symbols - both are valid
		if (result.unused.length > 0) {
			const unusedSym = result.unused[0];
			expect(unusedSym).toHaveProperty("name");
			expect(unusedSym).toHaveProperty("kind");
			expect(unusedSym).toHaveProperty("file");
			expect(unusedSym).toHaveProperty("lines");
		}
	});
});
