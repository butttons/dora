// Configuration management

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { ZodError, z } from "zod";
import { CtxError } from "./errors.ts";
import { getConfigPath, getDoraDir } from "./paths.ts";

// Zod schemas for configuration validation

const IndexStateSchema = z.object({
	gitCommit: z.string(),
	gitHasUncommitted: z.boolean(),
	fileCount: z.number(),
	symbolCount: z.number(),
	scipMtime: z.number(),
	databaseMtime: z.number(),
});

const ConfigSchema = z.object({
	root: z.string().min(1),
	scip: z.string().min(1),
	db: z.string().min(1),
	commands: z
		.object({
			index: z.string().optional(),
		})
		.optional(),
	lastIndexed: z.string().nullable(),
	indexState: IndexStateSchema.optional(),
});

// Export types inferred from schemas
export type IndexState = z.infer<typeof IndexStateSchema>;
export type Config = z.infer<typeof ConfigSchema>;

/**
 * Load configuration from .dora/config.json
 */
export async function loadConfig(root?: string): Promise<Config> {
	if (!root) {
		const { findRepoRoot } = await import("./paths.ts");
		root = await findRepoRoot();
	}

	const configPath = getConfigPath(root);

	if (!existsSync(configPath)) {
		throw new CtxError(
			`No config found. Run 'dora init' first to initialize the repository.`,
		);
	}

	try {
		const file = Bun.file(configPath);
		const data = await file.json();
		return validateConfig(data);
	} catch (error) {
		throw new CtxError(
			`Failed to read config: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Save configuration to .dora/config.json
 */
export async function saveConfig(config: Config): Promise<void> {
	const configPath = getConfigPath(config.root);

	try {
		await Bun.write(configPath, JSON.stringify(config, null, 2) + "\n");
	} catch (error) {
		throw new CtxError(
			`Failed to write config: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Validate configuration object using Zod schema
 */
export function validateConfig(data: unknown): Config {
	const result = ConfigSchema.safeParse(data);

	if (!result.success) {
		// Convert Zod errors to more user-friendly messages
		const firstError = result.error.issues[0];
		const field = firstError.path.join(".");
		throw new CtxError(
			`Invalid config: ${field ? `field '${field}' ` : ""}${firstError.message}`,
		);
	}

	return result.data;
}

/**
 * Detect if project uses workspaces
 */
function detectWorkspaceType(root: string): "pnpm" | "yarn" | null {
	// Check for pnpm workspaces
	if (existsSync(join(root, "pnpm-workspace.yaml"))) {
		return "pnpm";
	}

	// Check for yarn workspaces
	const packageJsonPath = join(root, "package.json");
	if (existsSync(packageJsonPath)) {
		try {
			const content = readFileSync(packageJsonPath, "utf-8");
			const packageJson = JSON.parse(content);
			if (packageJson.workspaces) {
				return "yarn";
			}
		} catch {
			// Ignore JSON parse errors
		}
	}

	return null;
}

/**
 * Detect project type and return appropriate SCIP indexer command
 */
function detectIndexerCommand(root: string): string {
	const hasTsConfig = existsSync(join(root, "tsconfig.json"));
	const hasPackageJson = existsSync(join(root, "package.json"));

	// TypeScript/JavaScript projects
	if (hasTsConfig || hasPackageJson) {
		const workspaceType = detectWorkspaceType(root);

		// For JavaScript projects (no tsconfig.json), add --infer-tsconfig flag
		const needsInferTsConfig = !hasTsConfig && hasPackageJson;

		// Build command based on workspace type
		if (workspaceType === "pnpm") {
			return needsInferTsConfig
				? "scip-typescript index --infer-tsconfig --pnpm-workspaces --output .dora/index.scip"
				: "scip-typescript index --pnpm-workspaces --output .dora/index.scip";
		} else if (workspaceType === "yarn") {
			return needsInferTsConfig
				? "scip-typescript index --infer-tsconfig --yarn-workspaces --output .dora/index.scip"
				: "scip-typescript index --yarn-workspaces --output .dora/index.scip";
		} else {
			return needsInferTsConfig
				? "scip-typescript index --infer-tsconfig --output .dora/index.scip"
				: "scip-typescript index --output .dora/index.scip";
		}
	}

	// Python - check for Python project files
	if (
		existsSync(join(root, "setup.py")) ||
		existsSync(join(root, "pyproject.toml")) ||
		existsSync(join(root, "requirements.txt"))
	) {
		return "scip-python index --output .dora/index.scip";
	}

	// Rust - check for Cargo.toml
	if (existsSync(join(root, "Cargo.toml"))) {
		return "rust-analyzer scip --output .dora/index.scip";
	}

	// Go - check for go.mod
	if (existsSync(join(root, "go.mod"))) {
		return "scip-go --output .dora/index.scip";
	}

	// Java - check for Maven or Gradle
	if (
		existsSync(join(root, "pom.xml")) ||
		existsSync(join(root, "build.gradle")) ||
		existsSync(join(root, "build.gradle.kts"))
	) {
		return "scip-java index --output .dora/index.scip";
	}

	// Default to TypeScript (most common)
	return "scip-typescript index --output .dora/index.scip";
}

/**
 * Create default configuration
 */
export function createDefaultConfig(root: string): Config {
	const indexCommand = detectIndexerCommand(root);

	return {
		root,
		scip: ".dora/index.scip",
		db: ".dora/dora.db",
		commands: {
			index: indexCommand,
		},
		lastIndexed: null,
	};
}

/**
 * Check if repository is initialized (has .dora directory)
 */
export function isInitialized(root: string): boolean {
	return existsSync(getDoraDir(root));
}

/**
 * Check if repository is indexed (has database file)
 */
export async function isIndexed(config: Config): Promise<boolean> {
	const { resolveAbsolute } = await import("./paths.ts");
	const dbPath = resolveAbsolute(config.root, config.db);
	return existsSync(dbPath);
}
