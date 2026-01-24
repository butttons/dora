// Configuration management

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { ZodError, z } from "zod";
import { CtxError } from "./errors.ts";
import {
	findRepoRoot,
	getConfigPath,
	getDoraDir,
	resolveAbsolute,
} from "./paths.ts";

// Zod schemas for configuration validation

const IndexStateSchema = z.object({
	gitCommit: z.string(),
	gitHasUncommitted: z.boolean(),
	fileCount: z.number(),
	symbolCount: z.number(),
	scipMtime: z.number(),
	databaseMtime: z.number(),
});

export const LanguageSchema = z.enum([
	"typescript",
	"javascript",
	"python",
	"rust",
	"go",
	"java",
]);

const ConfigSchema = z.object({
	root: z.string().min(1),
	scip: z.string().min(1),
	db: z.string().min(1),
	language: LanguageSchema.optional(),
	commands: z
		.object({
			index: z.string().optional(),
		})
		.optional(),
	lastIndexed: z.string().nullable(),
	indexState: IndexStateSchema.optional(),
	ignore: z.array(z.string()).optional(),
});

// Export types inferred from schemas
export type IndexState = z.infer<typeof IndexStateSchema>;
export type Config = z.infer<typeof ConfigSchema>;

/**
 * Load configuration from .dora/config.json
 */
export async function loadConfig(root?: string): Promise<Config> {
	if (!root) {
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
			`Failed to read config: ${
				error instanceof Error ? error.message : String(error)
			}`,
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
			`Failed to write config: ${
				error instanceof Error ? error.message : String(error)
			}`,
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
 * Detect package manager and workspace type based on lock files
 */
function detectWorkspaceType(root: string): "bun" | "pnpm" | "yarn" | null {
	// Check for Bun first (bun.lockb)
	if (existsSync(join(root, "bun.lockb"))) {
		return "bun";
	}

	// Check for pnpm (pnpm-lock.yaml or pnpm-workspace.yaml)
	if (
		existsSync(join(root, "pnpm-lock.yaml")) ||
		existsSync(join(root, "pnpm-workspace.yaml"))
	) {
		return "pnpm";
	}

	// Check for Yarn (yarn.lock)
	if (existsSync(join(root, "yarn.lock"))) {
		return "yarn";
	}

	// Check for yarn workspaces in package.json as fallback
	const packageJsonPath = join(root, "package.json");
	if (existsSync(packageJsonPath)) {
		try {
			const content = readFileSync(packageJsonPath, "utf-8");
			const packageJson = JSON.parse(content);
			if (packageJson.workspaces) {
				return "yarn";
			}
		} catch {
		}
	}

	return null;
}

/**
 * Detect project type and return appropriate SCIP indexer command
 */
function detectIndexerCommand(params: {
	root: string;
	language?: string;
}): string {
	const { root, language } = params;

	if (language) {
		switch (language) {
			case "typescript":
			case "javascript": {
				const workspaceType = detectWorkspaceType(root);
				const needsInferTsConfig = language === "javascript";

				if (workspaceType === "bun") {
					return needsInferTsConfig
						? "scip-typescript index --infer-tsconfig --output .dora/index.scip"
						: "scip-typescript index --output .dora/index.scip";
				}
				if (workspaceType === "pnpm") {
					return needsInferTsConfig
						? "scip-typescript index --infer-tsconfig --pnpm-workspaces --output .dora/index.scip"
						: "scip-typescript index --pnpm-workspaces --output .dora/index.scip";
				}
				if (workspaceType === "yarn") {
					return needsInferTsConfig
						? "scip-typescript index --infer-tsconfig --yarn-workspaces --output .dora/index.scip"
						: "scip-typescript index --yarn-workspaces --output .dora/index.scip";
				}
				return needsInferTsConfig
					? "scip-typescript index --infer-tsconfig --output .dora/index.scip"
					: "scip-typescript index --output .dora/index.scip";
			}
			case "python":
				return "scip-python index --output .dora/index.scip";
			case "rust":
				return "rust-analyzer scip . --output .dora/index.scip";
			case "go":
				return "scip-go --output .dora/index.scip";
			case "java":
				return "scip-java index --output .dora/index.scip";
			default:
				return "scip-typescript index --output .dora/index.scip";
		}
	}

	const hasTsConfig = existsSync(join(root, "tsconfig.json"));
	const hasPackageJson = existsSync(join(root, "package.json"));

	if (hasTsConfig || hasPackageJson) {
		const workspaceType = detectWorkspaceType(root);

		const needsInferTsConfig = !hasTsConfig && hasPackageJson;

		if (workspaceType === "bun") {
			return needsInferTsConfig
				? "scip-typescript index --infer-tsconfig --output .dora/index.scip"
				: "scip-typescript index --output .dora/index.scip";
		}
		if (workspaceType === "pnpm") {
			return needsInferTsConfig
				? "scip-typescript index --infer-tsconfig --pnpm-workspaces --output .dora/index.scip"
				: "scip-typescript index --pnpm-workspaces --output .dora/index.scip";
		}
		if (workspaceType === "yarn") {
			return needsInferTsConfig
				? "scip-typescript index --infer-tsconfig --yarn-workspaces --output .dora/index.scip"
				: "scip-typescript index --yarn-workspaces --output .dora/index.scip";
		}
		return needsInferTsConfig
			? "scip-typescript index --infer-tsconfig --output .dora/index.scip"
			: "scip-typescript index --output .dora/index.scip";
	}

	if (
		existsSync(join(root, "setup.py")) ||
		existsSync(join(root, "pyproject.toml")) ||
		existsSync(join(root, "requirements.txt"))
	) {
		return "scip-python index --output .dora/index.scip";
	}

	if (existsSync(join(root, "Cargo.toml"))) {
		return "rust-analyzer scip . --output .dora/index.scip";
	}

	if (existsSync(join(root, "go.mod"))) {
		return "scip-go --output .dora/index.scip";
	}

	if (
		existsSync(join(root, "pom.xml")) ||
		existsSync(join(root, "build.gradle")) ||
		existsSync(join(root, "build.gradle.kts"))
	) {
		return "scip-java index --output .dora/index.scip";
	}

	return "scip-typescript index --output .dora/index.scip";
}

/**
 * Create default configuration
 */
export function createDefaultConfig(params: {
	root: string;
	language?: string;
}): Config {
	const indexCommand = detectIndexerCommand({
		root: params.root,
		language: params.language,
	});

	return {
		root: params.root,
		scip: ".dora/index.scip",
		db: ".dora/dora.db",
		language: params.language,
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
	const dbPath = resolveAbsolute({
		root: config.root,
		relativePath: config.db,
	});
	return existsSync(dbPath);
}
