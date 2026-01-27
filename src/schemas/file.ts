import { z } from "zod";

export const FileSymbolSchema = z.object({
	name: z.string(),
	kind: z.string(),
	lines: z.tuple([z.number(), z.number()]),
});

export const FileDependencySchema = z.object({
	path: z.string(),
	symbols: z.array(z.string()).optional(),
});

export const FileDependentSchema = z.object({
	path: z.string(),
	refs: z.number(),
});

export const FileResultSchema = z.object({
	path: z.string(),
	symbols: z.array(FileSymbolSchema),
	depends_on: z.array(FileDependencySchema),
	depended_by: z.array(FileDependentSchema),
});

export const LeavesResultSchema = z.object({
	max_dependents: z.number(),
	leaves: z.array(z.string()),
});

export const EntryPointsResultSchema = z.object({
	detected_from: z.enum(["config", "pattern"]),
	config_file: z.string().optional(),
	entries: z.array(
		z.object({
			path: z.string(),
			type: z.enum(["main", "bin", "lib", "export", "worker"]),
			name: z.string().optional(),
			description: z.string().optional(),
			language: z.string(),
		}),
	),
});

export type FileSymbol = z.infer<typeof FileSymbolSchema>;
export type FileDependency = z.infer<typeof FileDependencySchema>;
export type FileDependent = z.infer<typeof FileDependentSchema>;
export type FileResult = z.infer<typeof FileResultSchema>;
export type LeavesResult = z.infer<typeof LeavesResultSchema>;
export type EntryPointsResult = z.infer<typeof EntryPointsResultSchema>;
