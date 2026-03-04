export type ParameterInfo = {
	name: string;
	type: string | null;
};

export type FunctionInfo = {
	name: string;
	lines: [number, number];
	loc: number;
	cyclomatic_complexity: number;
	parameters: ParameterInfo[];
	return_type: string | null;
	is_async: boolean;
	is_exported: boolean;
	is_method: boolean;
	jsdoc: string | null;
	reference_count?: number;
};

export type MethodInfo = {
	name: string;
	line: number;
	is_async: boolean;
	cyclomatic_complexity: number;
};

export type ClassInfo = {
	name: string;
	lines: [number, number];
	extends_name: string | null;
	implements: string[];
	decorators: string[];
	is_abstract: boolean;
	methods: MethodInfo[];
	property_count: number;
	reference_count?: number;
};

export type FileMetrics = {
	loc: number;
	sloc: number;
	comment_lines: number;
	blank_lines: number;
	function_count: number;
	class_count: number;
	avg_complexity: number;
	max_complexity: number;
};
