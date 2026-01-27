import { z } from "zod";
import { DependencyNodeSchema } from "./base.ts";

export const DepsResultSchema = z.object({
	path: z.string(),
	depth: z.number(),
	dependencies: z.array(DependencyNodeSchema),
});

export const RDepsResultSchema = z.object({
	path: z.string(),
	depth: z.number(),
	dependents: z.array(DependencyNodeSchema),
});

export const PathResultSchema = z.object({
	from: z.string(),
	to: z.string(),
	path: z.array(z.string()),
	distance: z.number(),
});

export const ImportedFileSchema = z.object({
	file: z.string(),
	symbols: z.array(z.string()),
});

export const ImportsResultSchema = z.object({
	path: z.string(),
	imports: z.array(ImportedFileSchema),
});

export const ChangesResultSchema = z.object({
	ref: z.string(),
	changed: z.array(z.string()),
	impacted: z.array(z.string()),
	total_impacted: z.number(),
});

export const PackageResultSchema = z.object({
	name: z.string(),
	files: z.array(z.string()),
	exports: z.array(
		z.object({
			name: z.string(),
			kind: z.string(),
			file: z.string().optional(),
			lines: z.tuple([z.number(), z.number()]),
		}),
	),
	depends_on: z.array(z.string()),
	depended_by: z.array(z.string()),
});

export const OverviewResultSchema = z.object({
	packages: z.array(z.string()),
	file_count: z.number(),
	symbol_count: z.number(),
});

export const GraphResultSchema = z.object({
	root: z.string(),
	direction: z.string(),
	depth: z.number(),
	nodes: z.array(z.string()),
	edges: z.array(
		z.object({
			from: z.string(),
			to: z.string(),
		}),
	),
});

export type DepsResult = z.infer<typeof DepsResultSchema>;
export type RDepsResult = z.infer<typeof RDepsResultSchema>;
export type PathResult = z.infer<typeof PathResultSchema>;
export type ImportedFile = z.infer<typeof ImportedFileSchema>;
export type ImportsResult = z.infer<typeof ImportsResultSchema>;
export type ChangesResult = z.infer<typeof ChangesResultSchema>;
export type PackageResult = z.infer<typeof PackageResultSchema>;
export type OverviewResult = z.infer<typeof OverviewResultSchema>;
export type GraphResult = z.infer<typeof GraphResultSchema>;
