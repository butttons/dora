import { describe, test, expect } from "bun:test";
import { parseFunctionCaptures } from "../../src/tree-sitter/languages/typescript.ts";
import type Parser from "web-tree-sitter";

type NodeOverrides = {
	type?: string;
	text?: string;
	startIndex?: number;
	endIndex?: number;
	startPosition?: { row: number; column: number };
	endPosition?: { row: number; column: number };
	children?: Parser.Node[];
	namedChildren?: Parser.Node[];
	firstChild?: Parser.Node | null;
	previousNamedSibling?: Parser.Node | null;
	parent?: Parser.Node | null;
	childForFieldName?: (name: string) => Parser.Node | null;
};

function makeNode(overrides: NodeOverrides = {}): Parser.Node {
	const children = overrides.children ?? [];
	const namedChildren = overrides.namedChildren ?? [];
	const firstChild =
		overrides.firstChild ?? (children.length > 0 ? children[0] : null);

	return {
		type: overrides.type ?? "identifier",
		text: overrides.text ?? "",
		startIndex: overrides.startIndex ?? 0,
		endIndex: overrides.endIndex ?? 0,
		startPosition: overrides.startPosition ?? { row: 0, column: 0 },
		endPosition: overrides.endPosition ?? { row: 0, column: 0 },
		children,
		namedChildren,
		firstChild,
		previousNamedSibling: overrides.previousNamedSibling ?? null,
		parent: overrides.parent ?? null,
		childForFieldName: overrides.childForFieldName ?? (() => null),
	} as unknown as Parser.Node;
}

function makeCapture(name: string, node: Parser.Node): Parser.QueryCapture {
	return { name, node, patternIndex: 0 } as unknown as Parser.QueryCapture;
}

describe("parseFunctionCaptures capture type routing", () => {
	test("fn.declaration sets is_exported=false, is_method=false", () => {
		const declarationNode = makeNode({
			type: "function_declaration",
			startIndex: 0,
			endIndex: 50,
			startPosition: { row: 4, column: 0 },
			endPosition: { row: 9, column: 1 },
		});
		const nameNode = makeNode({
			type: "identifier",
			text: "foo",
			startIndex: 9,
			endIndex: 12,
		});
		const paramsNode = makeNode({
			type: "formal_parameters",
			startIndex: 12,
			endIndex: 14,
			namedChildren: [],
		});
		const bodyNode = makeNode({
			type: "statement_block",
			startIndex: 15,
			endIndex: 50,
		});

		const captures = [
			makeCapture("fn.declaration", declarationNode),
			makeCapture("fn.name", nameNode),
			makeCapture("fn.params", paramsNode),
			makeCapture("fn.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const results = parseFunctionCaptures(captures);

		expect(results).toHaveLength(1);
		expect(results[0]!.name).toBe("foo");
		expect(results[0]!.is_exported).toBe(false);
		expect(results[0]!.is_method).toBe(false);
	});

	test("fn.export sets is_exported=true", () => {
		const declarationNode = makeNode({
			type: "export_statement",
			startIndex: 0,
			endIndex: 60,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 5, column: 1 },
			childForFieldName: (name: string) => {
				if (name === "declaration") {
					return makeNode({
						type: "function_declaration",
						startIndex: 7,
						endIndex: 60,
						namedChildren: [],
					});
				}
				return null;
			},
		});
		const nameNode = makeNode({
			type: "identifier",
			text: "exportedFn",
			startIndex: 16,
			endIndex: 26,
		});
		const paramsNode = makeNode({
			type: "formal_parameters",
			startIndex: 26,
			endIndex: 28,
			namedChildren: [],
		});
		const bodyNode = makeNode({
			type: "statement_block",
			startIndex: 29,
			endIndex: 60,
		});

		const captures = [
			makeCapture("fn.export", declarationNode),
			makeCapture("fn.name", nameNode),
			makeCapture("fn.params", paramsNode),
			makeCapture("fn.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const results = parseFunctionCaptures(captures);

		expect(results).toHaveLength(1);
		expect(results[0]!.is_exported).toBe(true);
		expect(results[0]!.is_method).toBe(false);
	});

	test("fn.arrow is detected as arrow function", () => {
		const declarationNode = makeNode({
			type: "lexical_declaration",
			startIndex: 0,
			endIndex: 40,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 0, column: 40 },
			namedChildren: [
				makeNode({
					type: "variable_declarator",
					startIndex: 4,
					endIndex: 40,
					namedChildren: [
						makeNode({
							type: "identifier",
							text: "arrowFn",
							startIndex: 4,
							endIndex: 11,
						}),
						makeNode({
							type: "arrow_function",
							startIndex: 14,
							endIndex: 40,
							namedChildren: [],
						}),
					],
				}),
			],
		});
		const nameNode = makeNode({
			type: "identifier",
			text: "arrowFn",
			startIndex: 4,
			endIndex: 11,
		});
		const paramsNode = makeNode({
			type: "formal_parameters",
			startIndex: 14,
			endIndex: 16,
			namedChildren: [],
		});
		const bodyNode = makeNode({
			type: "statement_block",
			startIndex: 20,
			endIndex: 40,
		});

		const captures = [
			makeCapture("fn.arrow", declarationNode),
			makeCapture("fn.name", nameNode),
			makeCapture("fn.params", paramsNode),
			makeCapture("fn.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const results = parseFunctionCaptures(captures);

		expect(results).toHaveLength(1);
		expect(results[0]!.name).toBe("arrowFn");
	});

	test("fn.export_arrow sets is_exported=true", () => {
		const declarationNode = makeNode({
			type: "export_statement",
			startIndex: 0,
			endIndex: 50,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 0, column: 50 },
			childForFieldName: (name: string) => {
				if (name === "declaration") {
					return makeNode({
						type: "lexical_declaration",
						startIndex: 7,
						endIndex: 50,
						namedChildren: [
							makeNode({
								type: "variable_declarator",
								startIndex: 11,
								endIndex: 50,
								namedChildren: [],
							}),
						],
					});
				}
				return null;
			},
		});
		const nameNode = makeNode({
			type: "identifier",
			text: "exportedArrow",
			startIndex: 11,
			endIndex: 24,
		});
		const paramsNode = makeNode({
			type: "formal_parameters",
			startIndex: 27,
			endIndex: 29,
			namedChildren: [],
		});
		const bodyNode = makeNode({
			type: "statement_block",
			startIndex: 33,
			endIndex: 50,
		});

		const captures = [
			makeCapture("fn.export_arrow", declarationNode),
			makeCapture("fn.name", nameNode),
			makeCapture("fn.params", paramsNode),
			makeCapture("fn.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const results = parseFunctionCaptures(captures);

		expect(results).toHaveLength(1);
		expect(results[0]!.is_exported).toBe(true);
	});

	test("fn.method sets is_method=true, is_exported=false", () => {
		const declarationNode = makeNode({
			type: "method_definition",
			startIndex: 0,
			endIndex: 50,
			startPosition: { row: 1, column: 2 },
			endPosition: { row: 6, column: 3 },
		});
		const nameNode = makeNode({
			type: "property_identifier",
			text: "myMethod",
			startIndex: 0,
			endIndex: 8,
		});
		const paramsNode = makeNode({
			type: "formal_parameters",
			startIndex: 8,
			endIndex: 10,
			namedChildren: [],
		});
		const bodyNode = makeNode({
			type: "statement_block",
			startIndex: 11,
			endIndex: 50,
		});

		const captures = [
			makeCapture("fn.method", declarationNode),
			makeCapture("fn.name", nameNode),
			makeCapture("fn.params", paramsNode),
			makeCapture("fn.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const results = parseFunctionCaptures(captures);

		expect(results).toHaveLength(1);
		expect(results[0]!.is_method).toBe(true);
		expect(results[0]!.is_exported).toBe(false);
	});

	test("unknown capture name like fn.other is ignored", () => {
		const declarationNode = makeNode({
			type: "function_declaration",
			startIndex: 0,
			endIndex: 50,
		});
		const nameNode = makeNode({
			type: "identifier",
			text: "foo",
			startIndex: 9,
			endIndex: 12,
		});
		const paramsNode = makeNode({
			type: "formal_parameters",
			startIndex: 12,
			endIndex: 14,
			namedChildren: [],
		});
		const bodyNode = makeNode({
			type: "statement_block",
			startIndex: 15,
			endIndex: 50,
		});

		const captures = [
			makeCapture("fn.other", declarationNode),
			makeCapture("fn.name", nameNode),
			makeCapture("fn.params", paramsNode),
			makeCapture("fn.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const results = parseFunctionCaptures(captures);

		expect(results).toHaveLength(0);
	});
});

describe("parseFunctionCaptures deduplication", () => {
	test("two captures with same startIndex only emit one result", () => {
		const declarationNode = makeNode({
			type: "function_declaration",
			startIndex: 0,
			endIndex: 50,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 5, column: 1 },
		});
		const nameNode = makeNode({
			type: "identifier",
			text: "foo",
			startIndex: 9,
			endIndex: 12,
		});
		const paramsNode = makeNode({
			type: "formal_parameters",
			startIndex: 12,
			endIndex: 14,
			namedChildren: [],
		});
		const bodyNode = makeNode({
			type: "statement_block",
			startIndex: 15,
			endIndex: 50,
		});

		const captures = [
			makeCapture("fn.declaration", declarationNode),
			makeCapture("fn.declaration", declarationNode),
			makeCapture("fn.name", nameNode),
			makeCapture("fn.params", paramsNode),
			makeCapture("fn.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const results = parseFunctionCaptures(captures);

		expect(results).toHaveLength(1);
		expect(results[0]!.name).toBe("foo");
	});
});

describe("parseFunctionCaptures async detection", () => {
	test("node with async child has is_async=true", () => {
		const declarationNode = makeNode({
			type: "function_declaration",
			startIndex: 0,
			endIndex: 60,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 5, column: 1 },
			children: [
				makeNode({ type: "async", text: "async", startIndex: 0, endIndex: 5 }),
			],
		});
		const nameNode = makeNode({
			type: "identifier",
			text: "asyncFn",
			startIndex: 15,
			endIndex: 22,
		});
		const paramsNode = makeNode({
			type: "formal_parameters",
			startIndex: 22,
			endIndex: 24,
			namedChildren: [],
		});
		const bodyNode = makeNode({
			type: "statement_block",
			startIndex: 25,
			endIndex: 60,
		});

		const captures = [
			makeCapture("fn.declaration", declarationNode),
			makeCapture("fn.name", nameNode),
			makeCapture("fn.params", paramsNode),
			makeCapture("fn.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const results = parseFunctionCaptures(captures);

		expect(results).toHaveLength(1);
		expect(results[0]!.is_async).toBe(true);
	});

	test("node without async child has is_async=false", () => {
		const declarationNode = makeNode({
			type: "function_declaration",
			startIndex: 0,
			endIndex: 50,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 5, column: 1 },
			children: [
				makeNode({
					type: "function",
					text: "function",
					startIndex: 0,
					endIndex: 8,
				}),
			],
		});
		const nameNode = makeNode({
			type: "identifier",
			text: "syncFn",
			startIndex: 9,
			endIndex: 15,
		});
		const paramsNode = makeNode({
			type: "formal_parameters",
			startIndex: 15,
			endIndex: 17,
			namedChildren: [],
		});
		const bodyNode = makeNode({
			type: "statement_block",
			startIndex: 18,
			endIndex: 50,
		});

		const captures = [
			makeCapture("fn.declaration", declarationNode),
			makeCapture("fn.name", nameNode),
			makeCapture("fn.params", paramsNode),
			makeCapture("fn.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const results = parseFunctionCaptures(captures);

		expect(results).toHaveLength(1);
		expect(results[0]!.is_async).toBe(false);
	});
});

describe("parseFunctionCaptures parameter extraction", () => {
	test("identifier child becomes { name, type: null }", () => {
		const declarationNode = makeNode({
			type: "function_declaration",
			startIndex: 0,
			endIndex: 50,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 5, column: 1 },
		});
		const nameNode = makeNode({
			type: "identifier",
			text: "foo",
			startIndex: 9,
			endIndex: 12,
		});
		const paramIdNode = makeNode({
			type: "identifier",
			text: "x",
			startIndex: 13,
			endIndex: 14,
		});
		const paramsNode = makeNode({
			type: "formal_parameters",
			startIndex: 12,
			endIndex: 15,
			namedChildren: [paramIdNode],
		});
		const bodyNode = makeNode({
			type: "statement_block",
			startIndex: 16,
			endIndex: 50,
		});

		const captures = [
			makeCapture("fn.declaration", declarationNode),
			makeCapture("fn.name", nameNode),
			makeCapture("fn.params", paramsNode),
			makeCapture("fn.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const results = parseFunctionCaptures(captures);

		expect(results).toHaveLength(1);
		expect(results[0]!.parameters).toEqual([{ name: "x", type: null }]);
	});

	test("required_parameter with pattern and type fields", () => {
		const declarationNode = makeNode({
			type: "function_declaration",
			startIndex: 0,
			endIndex: 60,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 5, column: 1 },
		});
		const nameNode = makeNode({
			type: "identifier",
			text: "foo",
			startIndex: 9,
			endIndex: 12,
		});
		const patternNode = makeNode({
			type: "identifier",
			text: "user",
			startIndex: 13,
			endIndex: 17,
		});
		const typeNode = makeNode({
			type: "type_annotation",
			text: ": User",
			startIndex: 17,
			endIndex: 23,
		});
		const paramNode = makeNode({
			type: "required_parameter",
			startIndex: 13,
			endIndex: 23,
			childForFieldName: (name: string) => {
				if (name === "pattern") return patternNode;
				if (name === "type") return typeNode;
				return null;
			},
		});
		const paramsNode = makeNode({
			type: "formal_parameters",
			startIndex: 12,
			endIndex: 24,
			namedChildren: [paramNode],
		});
		const bodyNode = makeNode({
			type: "statement_block",
			startIndex: 25,
			endIndex: 60,
		});

		const captures = [
			makeCapture("fn.declaration", declarationNode),
			makeCapture("fn.name", nameNode),
			makeCapture("fn.params", paramsNode),
			makeCapture("fn.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const results = parseFunctionCaptures(captures);

		expect(results).toHaveLength(1);
		expect(results[0]!.parameters).toEqual([{ name: "user", type: "User" }]);
	});

	test('rest_pattern becomes { name: "...args", type: null }', () => {
		const declarationNode = makeNode({
			type: "function_declaration",
			startIndex: 0,
			endIndex: 60,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 5, column: 1 },
		});
		const nameNode = makeNode({
			type: "identifier",
			text: "foo",
			startIndex: 9,
			endIndex: 12,
		});
		const restElementNode = makeNode({
			type: "identifier",
			text: "args",
			startIndex: 16,
			endIndex: 20,
		});
		const restNode = makeNode({
			type: "rest_pattern",
			startIndex: 15,
			endIndex: 20,
			namedChildren: [restElementNode],
		});
		const paramsNode = makeNode({
			type: "formal_parameters",
			startIndex: 12,
			endIndex: 21,
			namedChildren: [restNode],
		});
		const bodyNode = makeNode({
			type: "statement_block",
			startIndex: 22,
			endIndex: 60,
		});

		const captures = [
			makeCapture("fn.declaration", declarationNode),
			makeCapture("fn.name", nameNode),
			makeCapture("fn.params", paramsNode),
			makeCapture("fn.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const results = parseFunctionCaptures(captures);

		expect(results).toHaveLength(1);
		expect(results[0]!.parameters).toEqual([{ name: "...args", type: null }]);
	});

	test("assignment_pattern uses name from left field", () => {
		const declarationNode = makeNode({
			type: "function_declaration",
			startIndex: 0,
			endIndex: 70,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 5, column: 1 },
		});
		const nameNode = makeNode({
			type: "identifier",
			text: "foo",
			startIndex: 9,
			endIndex: 12,
		});
		const leftNode = makeNode({
			type: "identifier",
			text: "options",
			startIndex: 13,
			endIndex: 20,
		});
		const assignmentNode = makeNode({
			type: "assignment_pattern",
			startIndex: 13,
			endIndex: 30,
			childForFieldName: (name: string) => {
				if (name === "left") return leftNode;
				return null;
			},
		});
		const paramsNode = makeNode({
			type: "formal_parameters",
			startIndex: 12,
			endIndex: 31,
			namedChildren: [assignmentNode],
		});
		const bodyNode = makeNode({
			type: "statement_block",
			startIndex: 32,
			endIndex: 70,
		});

		const captures = [
			makeCapture("fn.declaration", declarationNode),
			makeCapture("fn.name", nameNode),
			makeCapture("fn.params", paramsNode),
			makeCapture("fn.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const results = parseFunctionCaptures(captures);

		expect(results).toHaveLength(1);
		expect(results[0]!.parameters).toEqual([{ name: "options", type: null }]);
	});
});

describe("parseFunctionCaptures return type", () => {
	test('fn.return_type capture strips leading ": "', () => {
		const declarationNode = makeNode({
			type: "function_declaration",
			startIndex: 0,
			endIndex: 60,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 5, column: 1 },
		});
		const nameNode = makeNode({
			type: "identifier",
			text: "foo",
			startIndex: 9,
			endIndex: 12,
		});
		const paramsNode = makeNode({
			type: "formal_parameters",
			startIndex: 12,
			endIndex: 14,
			namedChildren: [],
		});
		const bodyNode = makeNode({
			type: "statement_block",
			startIndex: 25,
			endIndex: 60,
		});
		const returnTypeNode = makeNode({
			type: "type_annotation",
			text: ": Promise<string>",
			startIndex: 15,
			endIndex: 32,
		});

		const captures = [
			makeCapture("fn.declaration", declarationNode),
			makeCapture("fn.name", nameNode),
			makeCapture("fn.params", paramsNode),
			makeCapture("fn.body", bodyNode),
			makeCapture("fn.return_type", returnTypeNode),
		] as unknown as Parser.QueryCapture[];

		const results = parseFunctionCaptures(captures);

		expect(results).toHaveLength(1);
		expect(results[0]!.return_type).toBe("Promise<string>");
	});

	test("no fn.return_type capture results in return_type=null", () => {
		const declarationNode = makeNode({
			type: "function_declaration",
			startIndex: 0,
			endIndex: 50,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 5, column: 1 },
		});
		const nameNode = makeNode({
			type: "identifier",
			text: "foo",
			startIndex: 9,
			endIndex: 12,
		});
		const paramsNode = makeNode({
			type: "formal_parameters",
			startIndex: 12,
			endIndex: 14,
			namedChildren: [],
		});
		const bodyNode = makeNode({
			type: "statement_block",
			startIndex: 15,
			endIndex: 50,
		});

		const captures = [
			makeCapture("fn.declaration", declarationNode),
			makeCapture("fn.name", nameNode),
			makeCapture("fn.params", paramsNode),
			makeCapture("fn.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const results = parseFunctionCaptures(captures);

		expect(results).toHaveLength(1);
		expect(results[0]!.return_type).toBe(null);
	});
});

describe("parseFunctionCaptures jsdoc", () => {
	test("previousNamedSibling comment starting with /** becomes jsdoc", () => {
		const jsdocNode = makeNode({
			type: "comment",
			text: "/** This is a JSDoc comment */",
			startIndex: 0,
			endIndex: 30,
		});
		const declarationNode = makeNode({
			type: "function_declaration",
			startIndex: 31,
			endIndex: 80,
			startPosition: { row: 2, column: 0 },
			endPosition: { row: 7, column: 1 },
			previousNamedSibling: jsdocNode,
		});
		const nameNode = makeNode({
			type: "identifier",
			text: "foo",
			startIndex: 40,
			endIndex: 43,
		});
		const paramsNode = makeNode({
			type: "formal_parameters",
			startIndex: 43,
			endIndex: 45,
			namedChildren: [],
		});
		const bodyNode = makeNode({
			type: "statement_block",
			startIndex: 46,
			endIndex: 80,
		});

		const captures = [
			makeCapture("fn.declaration", declarationNode),
			makeCapture("fn.name", nameNode),
			makeCapture("fn.params", paramsNode),
			makeCapture("fn.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const results = parseFunctionCaptures(captures);

		expect(results).toHaveLength(1);
		expect(results[0]!.jsdoc).toBe("/** This is a JSDoc comment */");
	});

	test("previousNamedSibling // comment results in jsdoc=null", () => {
		const commentNode = makeNode({
			type: "comment",
			text: "// This is a regular comment",
			startIndex: 0,
			endIndex: 28,
		});
		const declarationNode = makeNode({
			type: "function_declaration",
			startIndex: 29,
			endIndex: 70,
			startPosition: { row: 1, column: 0 },
			endPosition: { row: 6, column: 1 },
			previousNamedSibling: commentNode,
		});
		const nameNode = makeNode({
			type: "identifier",
			text: "foo",
			startIndex: 38,
			endIndex: 41,
		});
		const paramsNode = makeNode({
			type: "formal_parameters",
			startIndex: 41,
			endIndex: 43,
			namedChildren: [],
		});
		const bodyNode = makeNode({
			type: "statement_block",
			startIndex: 44,
			endIndex: 70,
		});

		const captures = [
			makeCapture("fn.declaration", declarationNode),
			makeCapture("fn.name", nameNode),
			makeCapture("fn.params", paramsNode),
			makeCapture("fn.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const results = parseFunctionCaptures(captures);

		expect(results).toHaveLength(1);
		expect(results[0]!.jsdoc).toBe(null);
	});

	test("no previousNamedSibling results in jsdoc=null", () => {
		const declarationNode = makeNode({
			type: "function_declaration",
			startIndex: 0,
			endIndex: 50,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 5, column: 1 },
			previousNamedSibling: null,
		});
		const nameNode = makeNode({
			type: "identifier",
			text: "foo",
			startIndex: 9,
			endIndex: 12,
		});
		const paramsNode = makeNode({
			type: "formal_parameters",
			startIndex: 12,
			endIndex: 14,
			namedChildren: [],
		});
		const bodyNode = makeNode({
			type: "statement_block",
			startIndex: 15,
			endIndex: 50,
		});

		const captures = [
			makeCapture("fn.declaration", declarationNode),
			makeCapture("fn.name", nameNode),
			makeCapture("fn.params", paramsNode),
			makeCapture("fn.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const results = parseFunctionCaptures(captures);

		expect(results).toHaveLength(1);
		expect(results[0]!.jsdoc).toBe(null);
	});
});

describe("parseFunctionCaptures line numbers", () => {
	test("startPosition.row=4, endPosition.row=9 produces lines=[5, 10], loc=6", () => {
		const declarationNode = makeNode({
			type: "function_declaration",
			startIndex: 0,
			endIndex: 50,
			startPosition: { row: 4, column: 0 },
			endPosition: { row: 9, column: 1 },
		});
		const nameNode = makeNode({
			type: "identifier",
			text: "foo",
			startIndex: 9,
			endIndex: 12,
		});
		const paramsNode = makeNode({
			type: "formal_parameters",
			startIndex: 12,
			endIndex: 14,
			namedChildren: [],
		});
		const bodyNode = makeNode({
			type: "statement_block",
			startIndex: 15,
			endIndex: 50,
		});

		const captures = [
			makeCapture("fn.declaration", declarationNode),
			makeCapture("fn.name", nameNode),
			makeCapture("fn.params", paramsNode),
			makeCapture("fn.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const results = parseFunctionCaptures(captures);

		expect(results).toHaveLength(1);
		expect(results[0]!.lines).toEqual([5, 10]);
		expect(results[0]!.loc).toBe(6);
	});
});

describe("parseFunctionCaptures missing required captures", () => {
	test("capture with no matching fn.name within range is skipped", () => {
		const declarationNode = makeNode({
			type: "function_declaration",
			startIndex: 0,
			endIndex: 50,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 5, column: 1 },
		});
		const paramsNode = makeNode({
			type: "formal_parameters",
			startIndex: 12,
			endIndex: 14,
			namedChildren: [],
		});
		const bodyNode = makeNode({
			type: "statement_block",
			startIndex: 15,
			endIndex: 50,
		});

		const captures = [
			makeCapture("fn.declaration", declarationNode),
			makeCapture("fn.params", paramsNode),
			makeCapture("fn.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const results = parseFunctionCaptures(captures);

		expect(results).toHaveLength(0);
	});

	test("capture with no matching fn.params within range is skipped", () => {
		const declarationNode = makeNode({
			type: "function_declaration",
			startIndex: 0,
			endIndex: 50,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 5, column: 1 },
		});
		const nameNode = makeNode({
			type: "identifier",
			text: "foo",
			startIndex: 9,
			endIndex: 12,
		});
		const bodyNode = makeNode({
			type: "statement_block",
			startIndex: 15,
			endIndex: 50,
		});

		const captures = [
			makeCapture("fn.declaration", declarationNode),
			makeCapture("fn.name", nameNode),
			makeCapture("fn.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const results = parseFunctionCaptures(captures);

		expect(results).toHaveLength(0);
	});

	test("capture with no matching fn.body within range is skipped", () => {
		const declarationNode = makeNode({
			type: "function_declaration",
			startIndex: 0,
			endIndex: 50,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 5, column: 1 },
		});
		const nameNode = makeNode({
			type: "identifier",
			text: "foo",
			startIndex: 9,
			endIndex: 12,
		});
		const paramsNode = makeNode({
			type: "formal_parameters",
			startIndex: 12,
			endIndex: 14,
			namedChildren: [],
		});

		const captures = [
			makeCapture("fn.declaration", declarationNode),
			makeCapture("fn.name", nameNode),
			makeCapture("fn.params", paramsNode),
		] as unknown as Parser.QueryCapture[];

		const results = parseFunctionCaptures(captures);

		expect(results).toHaveLength(0);
	});
});
