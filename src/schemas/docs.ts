import { z } from "zod";

export const DocumentSchema = z.object({
	path: z.string(),
	type: z.string(),
});

export const DocumentSymbolRefSchema = z.object({
	name: z.string(),
	kind: z.string(),
	path: z.string(),
	start_line: z.number(),
	lines: z.array(z.number()),
});

export const DocumentFileRefSchema = z.object({
	path: z.string(),
	lines: z.array(z.number()),
});

export const DocumentDocRefSchema = z.object({
	path: z.string(),
	lines: z.array(z.number()),
});

export const DocumentReferencesSchema = z.object({
	symbols: z.array(DocumentSymbolRefSchema),
	files: z.array(DocumentFileRefSchema),
	documents: z.array(DocumentDocRefSchema),
});

export const DocResultSchema = z.object({
	path: z.string(),
	type: z.string(),
	symbol_refs: z.array(DocumentSymbolRefSchema),
	file_refs: z.array(DocumentFileRefSchema),
	document_refs: z.array(DocumentDocRefSchema),
	content: z.string().optional(),
});

export const CookbookResultSchema = z.object({
	recipe: z.string(),
	content: z.string(),
});

export type Document = z.infer<typeof DocumentSchema>;
export type DocumentSymbolRef = z.infer<typeof DocumentSymbolRefSchema>;
export type DocumentFileRef = z.infer<typeof DocumentFileRefSchema>;
export type DocumentDocRef = z.infer<typeof DocumentDocRefSchema>;
export type DocumentReferences = z.infer<typeof DocumentReferencesSchema>;
export type DocResult = z.infer<typeof DocResultSchema>;
export type CookbookResult = z.infer<typeof CookbookResultSchema>;
