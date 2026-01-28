import { z } from "zod";

export const SymbolResultSchema = z.object({
	name: z.string(),
	kind: z.string(),
	path: z.string(),
	lines: z.tuple([z.number(), z.number()]).optional(),
});

export const SymbolSearchResultSchema = z.object({
	query: z.string(),
	results: z.array(SymbolResultSchema),
});

export const RefsResultSchema = z.object({
	symbol: z.string(),
	kind: z.string(),
	definition: z.object({
		path: z.string(),
		line: z.number(),
	}),
	references: z.array(z.string()),
	total_references: z.number(),
});

export const RefsSearchResultSchema = z.object({
	query: z.string(),
	results: z.array(RefsResultSchema),
});

export const ExportedSymbolSchema = z.object({
	name: z.string(),
	kind: z.string(),
	file: z.string().optional(),
	lines: z.tuple([z.number(), z.number()]),
});

export const ExportsResultSchema = z.object({
	target: z.string(),
	exports: z.array(ExportedSymbolSchema),
});

export const UnusedSymbolSchema = z.object({
	name: z.string(),
	file: z.string(),
	lines: z.tuple([z.number(), z.number()]),
	kind: z.string(),
});

export const UnusedResultSchema = z.object({
	unused: z.array(UnusedSymbolSchema),
});

export type SymbolResult = z.infer<typeof SymbolResultSchema>;
export type SymbolSearchResult = z.infer<typeof SymbolSearchResultSchema>;
export type RefsResult = z.infer<typeof RefsResultSchema>;
export type RefsSearchResult = z.infer<typeof RefsSearchResultSchema>;
export type ExportedSymbol = z.infer<typeof ExportedSymbolSchema>;
export type ExportsResult = z.infer<typeof ExportsResultSchema>;
export type UnusedSymbol = z.infer<typeof UnusedSymbolSchema>;
export type UnusedResult = z.infer<typeof UnusedResultSchema>;
