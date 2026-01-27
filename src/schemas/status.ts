import { z } from "zod";

export const InitResultSchema = z.object({
	success: z.boolean(),
	root: z.string(),
	message: z.string(),
});

export const StatusResultSchema = z.object({
	initialized: z.boolean(),
	indexed: z.boolean(),
	file_count: z.number().optional(),
	symbol_count: z.number().optional(),
	last_indexed: z.string().nullable().optional(),
	document_count: z.number().optional(),
	documents_by_type: z
		.array(
			z.object({
				type: z.string(),
				count: z.number(),
			}),
		)
		.optional(),
});

export const IndexResultSchema = z.object({
	success: z.boolean(),
	file_count: z.number(),
	symbol_count: z.number(),
	time_ms: z.number(),
	mode: z.enum(["full", "incremental", "cached"]).optional(),
	changed_files: z.number().optional(),
});

export const ReindexDecisionSchema = z.object({
	shouldReindex: z.boolean(),
	reason: z.string(),
	changedFiles: z.array(z.string()).optional(),
});

export type InitResult = z.infer<typeof InitResultSchema>;
export type StatusResult = z.infer<typeof StatusResultSchema>;
export type IndexResult = z.infer<typeof IndexResultSchema>;
export type ReindexDecision = z.infer<typeof ReindexDecisionSchema>;
