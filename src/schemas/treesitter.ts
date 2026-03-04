import { z } from "zod";

export const ParameterInfoSchema = z.object({
	name: z.string(),
	type: z.string().nullable(),
});

export const FunctionInfoSchema = z.object({
	name: z.string(),
	lines: z.tuple([z.number(), z.number()]),
	loc: z.number(),
	cyclomatic_complexity: z.number(),
	parameters: z.array(ParameterInfoSchema),
	return_type: z.string().nullable(),
	is_async: z.boolean(),
	is_exported: z.boolean(),
	is_method: z.boolean(),
	jsdoc: z.string().nullable(),
	reference_count: z.number().optional(),
});

export const MethodInfoSchema = z.object({
	name: z.string(),
	line: z.number(),
	is_async: z.boolean(),
	cyclomatic_complexity: z.number(),
});

export const ClassInfoSchema = z.object({
	name: z.string(),
	lines: z.tuple([z.number(), z.number()]),
	extends_name: z.string().nullable(),
	implements: z.array(z.string()),
	decorators: z.array(z.string()),
	is_abstract: z.boolean(),
	methods: z.array(MethodInfoSchema),
	property_count: z.number(),
	reference_count: z.number().optional(),
});

export const FileMetricsSchema = z.object({
	loc: z.number(),
	sloc: z.number(),
	comment_lines: z.number(),
	blank_lines: z.number(),
	function_count: z.number(),
	class_count: z.number(),
	avg_complexity: z.number(),
	max_complexity: z.number(),
});

export const FnResultSchema = z.object({
	path: z.string(),
	language: z.string(),
	functions: z.array(FunctionInfoSchema),
	file_stats: FileMetricsSchema,
});

export const SmellItemSchema = z.object({
	kind: z.string(),
	function: z.string(),
	line: z.number(),
	value: z.number(),
	threshold: z.number(),
	message: z.string(),
});

export const SmellsResultSchema = z.object({
	path: z.string(),
	clean: z.boolean(),
	smells: z.array(SmellItemSchema),
});

export const ClassResultSchema = z.object({
	path: z.string(),
	language: z.string(),
	classes: z.array(ClassInfoSchema),
});

export type ParameterInfo = z.infer<typeof ParameterInfoSchema>;
export type FunctionInfo = z.infer<typeof FunctionInfoSchema>;
export type MethodInfo = z.infer<typeof MethodInfoSchema>;
export type ClassInfo = z.infer<typeof ClassInfoSchema>;
export type FileMetrics = z.infer<typeof FileMetricsSchema>;
export type FnResult = z.infer<typeof FnResultSchema>;
export type SmellItem = z.infer<typeof SmellItemSchema>;
export type SmellsResult = z.infer<typeof SmellsResultSchema>;
export type ClassResult = z.infer<typeof ClassResultSchema>;
