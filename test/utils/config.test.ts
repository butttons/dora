// Tests for configuration management

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createDefaultConfig, validateConfig } from "../../src/utils/config.ts";
import { CtxError } from "../../src/utils/errors.ts";

describe("Config Management", () => {
	describe("validateConfig", () => {
		test("should validate a correct config", () => {
			const validConfig = {
				root: "/Users/test/repo",
				db: ".dora/dora.db",
				scip: ".dora/index.scip",
				commands: {
					index: "scip-typescript index --output .dora/index.scip",
				},
				lastIndexed: "2025-01-15T10:30:00Z",
			};

			const result = validateConfig(validConfig);
			expect(result).toEqual(validConfig);
		});

		test("should validate config without commands", () => {
			const validConfig = {
				root: "/Users/test/repo",
				db: ".dora/dora.db",
				scip: ".dora/index.scip",
				lastIndexed: null,
			};

			const result = validateConfig(validConfig);
			expect(result.root).toBe("/Users/test/repo");
			expect(result.commands).toBeUndefined();
		});

		test("should throw on missing root", () => {
			const invalidConfig = {
				db: ".dora/index.db",
				scip: ".dora/index.scip",
				lastIndexed: null,
			};

			expect(() => validateConfig(invalidConfig)).toThrow(CtxError);
			expect(() => validateConfig(invalidConfig)).toThrow(/field 'root'/);
		});

		test("should throw on missing db", () => {
			const invalidConfig = {
				root: "/Users/test/repo",
				scip: ".dora/index.scip",
				lastIndexed: null,
			};

			expect(() => validateConfig(invalidConfig)).toThrow(CtxError);
			expect(() => validateConfig(invalidConfig)).toThrow(/field 'db'/);
		});

		test("should throw on missing scip", () => {
			const invalidConfig = {
				root: "/Users/test/repo",
				db: ".dora/dora.db",
				lastIndexed: null,
			};

			expect(() => validateConfig(invalidConfig)).toThrow(CtxError);
			expect(() => validateConfig(invalidConfig)).toThrow(/field 'scip'/);
		});

		test("should throw on invalid commands type", () => {
			const invalidConfig = {
				root: "/Users/test/repo",
				db: ".dora/dora.db",
				scip: ".dora/index.scip",
				commands: "invalid",
				lastIndexed: null,
			};

			expect(() => validateConfig(invalidConfig)).toThrow(CtxError);
			expect(() => validateConfig(invalidConfig)).toThrow(/field 'commands'/);
		});

		test("should throw on invalid commands.index type", () => {
			const invalidConfig = {
				root: "/Users/test/repo",
				db: ".dora/dora.db",
				scip: ".dora/index.scip",
				commands: {
					index: 123,
				},
				lastIndexed: null,
			};

			expect(() => validateConfig(invalidConfig)).toThrow(CtxError);
			expect(() => validateConfig(invalidConfig)).toThrow(
				/field 'commands\.index'/,
			);
		});
	});

	describe("createDefaultConfig", () => {
		test("should create default config with correct structure", () => {
			const root = "/Users/test/repo";
			const config = createDefaultConfig(root);

			expect(config.root).toBe(root);
			expect(config.db).toBe(".dora/dora.db");
			expect(config.scip).toBe(".dora/index.scip");
			expect(config.commands).toBeDefined();
			expect(config.commands?.index).toBeDefined();
			expect(config.lastIndexed).toBeNull();
		});

		test("should create config with absolute root path", () => {
			const root = "/absolute/path/to/repo";
			const config = createDefaultConfig(root);

			expect(config.root).toBe(root);
		});
	});
});
