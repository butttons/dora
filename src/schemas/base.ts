import { z } from "zod";

export const DependencyNodeSchema = z.object({
	path: z.string(),
	depth: z.number(),
});

export const HotspotSchema = z.object({
	file: z.string(),
	count: z.number(),
});

export const GraphEdgeSchema = z.object({
	from: z.string(),
	to: z.string(),
});

export const ErrorResultSchema = z.object({
	error: z.string(),
});

export const EntryPointSchema = z.object({
	path: z.string(),
	type: z.enum(["main", "bin", "lib", "export", "worker"]),
	name: z.string().optional(),
	description: z.string().optional(),
	language: z.string(),
});

export const GlobalSymbolSchema = z.object({
	name: z.string(),
	kind: z.string(),
	path: z.string(),
	start_line: z.number(),
});

export const DefnEnclosingRangeSchema = z.object({
	path: z.string(),
	start_line: z.number(),
	end_line: z.number(),
});

export type DependencyNode = z.infer<typeof DependencyNodeSchema>;
export type Hotspot = z.infer<typeof HotspotSchema>;
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
export type ErrorResult = z.infer<typeof ErrorResultSchema>;
export type EntryPoint = z.infer<typeof EntryPointSchema>;
export type GlobalSymbol = z.infer<typeof GlobalSymbolSchema>;
export type DefnEnclosingRange = z.infer<typeof DefnEnclosingRangeSchema>;
