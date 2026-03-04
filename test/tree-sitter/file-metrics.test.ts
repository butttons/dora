import { describe, test, expect } from "bun:test";
import { calculateFileMetrics } from "../../src/tree-sitter/parser.ts";
import type { FunctionInfo, ClassInfo } from "../../src/schemas/treesitter.ts";

const makeFn = (complexity: number): FunctionInfo => ({
	name: "f",
	lines: [1, 1],
	loc: 1,
	cyclomatic_complexity: complexity,
	parameters: [],
	return_type: null,
	is_async: false,
	is_exported: false,
	is_method: false,
	jsdoc: null,
});

const makeCls = (): ClassInfo => ({
	name: "C",
	lines: [1, 1],
	extends_name: null,
	implements: [],
	decorators: [],
	is_abstract: false,
	methods: [],
	property_count: 0,
});

function assertMetricsInvariant(metrics: {
	loc: number;
	sloc: number;
	comment_lines: number;
	blank_lines: number;
}) {
	expect(metrics.sloc + metrics.comment_lines + metrics.blank_lines).toBe(
		metrics.loc,
	);
}

describe("calculateFileMetrics", () => {
	describe("blank lines", () => {
		test("counts 3 empty lines", () => {
			const content = "code\n\n\n";
			const functions: FunctionInfo[] = [];
			const classes: ClassInfo[] = [];

			const metrics = calculateFileMetrics({ content, functions, classes });

			expect(metrics.blank_lines).toBe(3);
			expect(metrics.loc).toBe(4);
			expect(metrics.sloc).toBe(1);
			assertMetricsInvariant(metrics);
		});

		test("counts lines with only whitespace as blank", () => {
			const content = "code\n   \n\t\n    ";
			const functions: FunctionInfo[] = [];
			const classes: ClassInfo[] = [];

			const metrics = calculateFileMetrics({ content, functions, classes });

			expect(metrics.blank_lines).toBe(3);
			expect(metrics.sloc).toBe(1);
			assertMetricsInvariant(metrics);
		});
	});

	describe("single-line comments", () => {
		test("counts lines starting with // as comment lines", () => {
			const content = "code\n// comment\nmore code";
			const functions: FunctionInfo[] = [];
			const classes: ClassInfo[] = [];

			const metrics = calculateFileMetrics({ content, functions, classes });

			expect(metrics.comment_lines).toBe(1);
			expect(metrics.sloc).toBe(2);
			assertMetricsInvariant(metrics);
		});

		test("does not count trailing // comment as comment line", () => {
			const content = "const x = 1; // trailing comment";
			const functions: FunctionInfo[] = [];
			const classes: ClassInfo[] = [];

			const metrics = calculateFileMetrics({ content, functions, classes });

			expect(metrics.comment_lines).toBe(0);
			expect(metrics.sloc).toBe(1);
			assertMetricsInvariant(metrics);
		});
	});

	describe("block comments", () => {
		test("counts inline /* */ as one comment line", () => {
			const content = "/* inline */";
			const functions: FunctionInfo[] = [];
			const classes: ClassInfo[] = [];

			const metrics = calculateFileMetrics({ content, functions, classes });

			expect(metrics.comment_lines).toBe(1);
			expect(metrics.sloc).toBe(0);
			assertMetricsInvariant(metrics);
		});

		test("counts multi-line block comment across all lines", () => {
			const content = "/* start\nmiddle\nend */";
			const functions: FunctionInfo[] = [];
			const classes: ClassInfo[] = [];

			const metrics = calculateFileMetrics({ content, functions, classes });

			expect(metrics.comment_lines).toBe(3);
			expect(metrics.sloc).toBe(0);
			assertMetricsInvariant(metrics);
		});

		test("exits block comment mode after closing */", () => {
			const content = "/* comment */\ncode after";
			const functions: FunctionInfo[] = [];
			const classes: ClassInfo[] = [];

			const metrics = calculateFileMetrics({ content, functions, classes });

			expect(metrics.comment_lines).toBe(1);
			expect(metrics.sloc).toBe(1);
			assertMetricsInvariant(metrics);
		});

		test("handles nested scenario: open, close, then code", () => {
			const content = "/* open\nstill comment\nclose */\ncode here";
			const functions: FunctionInfo[] = [];
			const classes: ClassInfo[] = [];

			const metrics = calculateFileMetrics({ content, functions, classes });

			expect(metrics.comment_lines).toBe(3);
			expect(metrics.sloc).toBe(1);
			assertMetricsInvariant(metrics);
		});
	});

	describe("isInBlockComment edge cases", () => {
		test("line with both /* and */ does not set isInBlockComment", () => {
			const content = "/* both */\ncode after";
			const functions: FunctionInfo[] = [];
			const classes: ClassInfo[] = [];

			const metrics = calculateFileMetrics({ content, functions, classes });

			expect(metrics.comment_lines).toBe(1);
			expect(metrics.sloc).toBe(1);
			assertMetricsInvariant(metrics);
		});

		test("line inside block comment that ends with */ exits block comment mode", () => {
			const content = "/* open\ninside\nstill inside\n*/ out";
			const functions: FunctionInfo[] = [];
			const classes: ClassInfo[] = [];

			const metrics = calculateFileMetrics({ content, functions, classes });

			expect(metrics.comment_lines).toBe(4);
			expect(metrics.sloc).toBe(0);
			assertMetricsInvariant(metrics);
		});
	});

	describe("function and class counts with complexity", () => {
		test("empty functions and classes returns zeros", () => {
			const content = "code";
			const functions: FunctionInfo[] = [];
			const classes: ClassInfo[] = [];

			const metrics = calculateFileMetrics({ content, functions, classes });

			expect(metrics.function_count).toBe(0);
			expect(metrics.class_count).toBe(0);
			expect(metrics.avg_complexity).toBe(0);
			expect(metrics.max_complexity).toBe(0);
			assertMetricsInvariant(metrics);
		});

		test("3 functions with complexities [1, 3, 5]", () => {
			const content = "code";
			const functions = [makeFn(1), makeFn(3), makeFn(5)];
			const classes: ClassInfo[] = [];

			const metrics = calculateFileMetrics({ content, functions, classes });

			expect(metrics.function_count).toBe(3);
			expect(metrics.avg_complexity).toBe(3);
			expect(metrics.max_complexity).toBe(5);
			assertMetricsInvariant(metrics);
		});

		test("avg_complexity rounded to 2 decimals: [1, 2, 3] = 2.00", () => {
			const content = "code";
			const functions = [makeFn(1), makeFn(2), makeFn(3)];
			const classes: ClassInfo[] = [];

			const metrics = calculateFileMetrics({ content, functions, classes });

			expect(metrics.avg_complexity).toBe(2.0);
			assertMetricsInvariant(metrics);
		});

		test("avg_complexity rounded to 2 decimals: [1, 1, 2] = 1.33", () => {
			const content = "code";
			const functions = [makeFn(1), makeFn(1), makeFn(2)];
			const classes: ClassInfo[] = [];

			const metrics = calculateFileMetrics({ content, functions, classes });

			expect(metrics.avg_complexity).toBe(1.33);
			assertMetricsInvariant(metrics);
		});

		test("2 classes counted correctly", () => {
			const content = "code";
			const functions: FunctionInfo[] = [];
			const classes = [makeCls(), makeCls()];

			const metrics = calculateFileMetrics({ content, functions, classes });

			expect(metrics.class_count).toBe(2);
			assertMetricsInvariant(metrics);
		});
	});

	describe("sloc correctness", () => {
		test("file with only code lines has sloc = loc", () => {
			const content = "line1\nline2\nline3";
			const functions: FunctionInfo[] = [];
			const classes: ClassInfo[] = [];

			const metrics = calculateFileMetrics({ content, functions, classes });

			expect(metrics.loc).toBe(3);
			expect(metrics.sloc).toBe(3);
			expect(metrics.blank_lines).toBe(0);
			expect(metrics.comment_lines).toBe(0);
			assertMetricsInvariant(metrics);
		});

		test("file with mix of code, blanks, comments has correct sloc", () => {
			const content = "code1\n\n// comment\ncode2";
			const functions: FunctionInfo[] = [];
			const classes: ClassInfo[] = [];

			const metrics = calculateFileMetrics({ content, functions, classes });

			expect(metrics.loc).toBe(4);
			expect(metrics.blank_lines).toBe(1);
			expect(metrics.comment_lines).toBe(1);
			expect(metrics.sloc).toBe(2);
			assertMetricsInvariant(metrics);
		});
	});
});
