import { z } from "zod";
import { HotspotSchema } from "./base.ts";

export const CycleSchema = z.object({
	files: z.array(z.string()),
	length: z.number(),
});

export const CyclesResultSchema = z.object({
	cycles: z.array(CycleSchema),
});

export const CoupledFilesSchema = z.object({
	file1: z.string(),
	file2: z.string(),
	symbols_1_to_2: z.number(),
	symbols_2_to_1: z.number(),
	total_coupling: z.number(),
});

export const CouplingResultSchema = z.object({
	threshold: z.number(),
	coupled_files: z.array(CoupledFilesSchema),
});

export const ComplexityMetricSchema = z.object({
	path: z.string(),
	symbol_count: z.number(),
	outgoing_deps: z.number(),
	incoming_deps: z.number(),
	stability_ratio: z.number(),
	complexity_score: z.number(),
});

export const ComplexityResultSchema = z.object({
	sort_by: z.string(),
	files: z.array(ComplexityMetricSchema),
});

export const HotspotsResultSchema = z.object({
	most_referenced: z.array(HotspotSchema),
	most_dependencies: z.array(HotspotSchema),
});

export type Cycle = z.infer<typeof CycleSchema>;
export type CyclesResult = z.infer<typeof CyclesResultSchema>;
export type CoupledFiles = z.infer<typeof CoupledFilesSchema>;
export type CouplingResult = z.infer<typeof CouplingResultSchema>;
export type ComplexityMetric = z.infer<typeof ComplexityMetricSchema>;
export type ComplexityResult = z.infer<typeof ComplexityResultSchema>;
export type HotspotsResult = z.infer<typeof HotspotsResultSchema>;
