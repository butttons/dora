import { describe, expect, test } from "bun:test";
import { parseClassCaptures } from "../../src/tree-sitter/languages/typescript.ts";
import type Parser from "web-tree-sitter";

type NodeOverrides = Partial<
	Omit<
		Parser.Node,
		"parent" | "previousNamedSibling" | "children" | "namedChildren"
	> & {
		parent?: Parser.Node | null;
		previousNamedSibling?: Parser.Node | null;
		children?: Parser.Node[];
		namedChildren?: Parser.Node[];
	}
>;

function makeNode(overrides: NodeOverrides = {}): Parser.Node {
	const defaults = {
		type: "class_declaration",
		text: "",
		startIndex: 0,
		endIndex: 100,
		startPosition: { row: 0, column: 0 },
		endPosition: { row: 0, column: 10 },
		children: [] as Parser.Node[],
		namedChildren: [] as Parser.Node[],
		previousNamedSibling: null as Parser.Node | null,
		parent: null as Parser.Node | null,
	};

	const merged = { ...defaults, ...overrides };

	return {
		type: merged.type,
		text: merged.text,
		startIndex: merged.startIndex,
		endIndex: merged.endIndex,
		startPosition: merged.startPosition,
		endPosition: merged.endPosition,
		children: merged.children,
		namedChildren: merged.namedChildren,
		previousNamedSibling: merged.previousNamedSibling,
		parent: merged.parent,
		childForFieldName: (_name: string): Parser.Node | null => {
			return null;
		},
	} as unknown as Parser.Node;
}

function makeCapture(name: string, node: Parser.Node): Parser.QueryCapture {
	return { name, node, patternIndex: 0 } as unknown as Parser.QueryCapture;
}

describe("parseClassCaptures", () => {
	test("basic class declaration", () => {
		const classNode = makeNode({
			type: "class_declaration",
			text: "class Foo {}",
			startIndex: 0,
			endIndex: 12,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 0, column: 12 },
		});

		const nameNode = makeNode({
			type: "type_identifier",
			text: "Foo",
			startIndex: 6,
			endIndex: 9,
			startPosition: { row: 0, column: 6 },
			endPosition: { row: 0, column: 9 },
		});

		const bodyNode = makeNode({
			type: "class_body",
			text: "{}",
			startIndex: 10,
			endIndex: 12,
			startPosition: { row: 0, column: 10 },
			endPosition: { row: 0, column: 12 },
			namedChildren: [],
			children: [],
			parent: classNode,
		});

		const captures = [
			makeCapture("cls.declaration", classNode),
			makeCapture("cls.name", nameNode),
			makeCapture("cls.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const result = parseClassCaptures(captures);

		expect(result).toHaveLength(1);
		expect(result[0]!.name).toBe("Foo");
		expect(result[0]!.lines).toEqual([1, 1]);
		expect(result[0]!.is_abstract).toBe(false);
		expect(result[0]!.decorators).toEqual([]);
		expect(result[0]!.implements).toEqual([]);
		expect(result[0]!.extends_name).toBeNull();
		expect(result[0]!.methods).toEqual([]);
		expect(result[0]!.property_count).toBe(0);
	});

	test("exported class unwraps correctly", () => {
		const exportNode = makeNode({
			type: "export_statement",
			text: "export class Bar {}",
			startIndex: 0,
			endIndex: 19,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 0, column: 19 },
		});

		const classNode = makeNode({
			type: "class_declaration",
			text: "class Bar {}",
			startIndex: 7,
			endIndex: 19,
			startPosition: { row: 0, column: 7 },
			endPosition: { row: 0, column: 19 },
			parent: exportNode,
		});

		(exportNode as unknown as { namedChildren: Parser.Node[] }).namedChildren =
			[classNode];

		const nameNode = makeNode({
			type: "type_identifier",
			text: "Bar",
			startIndex: 13,
			endIndex: 16,
			startPosition: { row: 0, column: 13 },
			endPosition: { row: 0, column: 16 },
		});

		const bodyNode = makeNode({
			type: "class_body",
			text: "{}",
			startIndex: 17,
			endIndex: 19,
			startPosition: { row: 0, column: 17 },
			endPosition: { row: 0, column: 19 },
			namedChildren: [],
			children: [],
			parent: classNode,
		});

		const captures = [
			makeCapture("cls.export", exportNode),
			makeCapture("cls.name", nameNode),
			makeCapture("cls.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const result = parseClassCaptures(captures);

		expect(result).toHaveLength(1);
		expect(result[0]!.name).toBe("Bar");
		expect(result[0]!.lines).toEqual([1, 1]);
		expect(result[0]!.is_abstract).toBe(false);
	});

	test("deduplication of same startIndex", () => {
		const classNode = makeNode({
			type: "class_declaration",
			startIndex: 50,
			endIndex: 100,
			startPosition: { row: 1, column: 0 },
			endPosition: { row: 5, column: 1 },
		});

		const nameNode = makeNode({
			type: "type_identifier",
			text: "Baz",
			startIndex: 56,
			endIndex: 59,
			startPosition: { row: 1, column: 6 },
			endPosition: { row: 1, column: 9 },
		});

		const bodyNode = makeNode({
			type: "class_body",
			startIndex: 60,
			endIndex: 100,
			startPosition: { row: 1, column: 10 },
			endPosition: { row: 5, column: 1 },
			namedChildren: [],
			children: [],
			parent: classNode,
		});

		const captures = [
			makeCapture("cls.declaration", classNode),
			makeCapture("cls.declaration", classNode),
			makeCapture("cls.name", nameNode),
			makeCapture("cls.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const result = parseClassCaptures(captures);

		expect(result).toHaveLength(1);
		expect(result[0]!.name).toBe("Baz");
	});

	test("extends clause", () => {
		const classNode = makeNode({
			type: "class_declaration",
			startIndex: 0,
			endIndex: 30,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 0, column: 30 },
		});

		const nameNode = makeNode({
			type: "type_identifier",
			text: "Child",
			startIndex: 6,
			endIndex: 11,
			startPosition: { row: 0, column: 6 },
			endPosition: { row: 0, column: 11 },
		});

		const extendsNode = makeNode({
			type: "type_identifier",
			text: "Parent",
			startIndex: 20,
			endIndex: 26,
			startPosition: { row: 0, column: 20 },
			endPosition: { row: 0, column: 26 },
		});

		const bodyNode = makeNode({
			type: "class_body",
			startIndex: 27,
			endIndex: 30,
			startPosition: { row: 0, column: 27 },
			endPosition: { row: 0, column: 30 },
			namedChildren: [],
			children: [],
			parent: classNode,
		});

		const captures = [
			makeCapture("cls.declaration", classNode),
			makeCapture("cls.name", nameNode),
			makeCapture("cls.body", bodyNode),
			makeCapture("cls.extends", extendsNode),
		] as unknown as Parser.QueryCapture[];

		const result = parseClassCaptures(captures);

		expect(result).toHaveLength(1);
		expect(result[0]!.extends_name).toBe("Parent");
	});

	test("no extends clause", () => {
		const classNode = makeNode({
			type: "class_declaration",
			startIndex: 0,
			endIndex: 15,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 0, column: 15 },
		});

		const nameNode = makeNode({
			type: "type_identifier",
			text: "Orphan",
			startIndex: 6,
			endIndex: 12,
			startPosition: { row: 0, column: 6 },
			endPosition: { row: 0, column: 12 },
		});

		const bodyNode = makeNode({
			type: "class_body",
			startIndex: 13,
			endIndex: 15,
			startPosition: { row: 0, column: 13 },
			endPosition: { row: 0, column: 15 },
			namedChildren: [],
			children: [],
			parent: classNode,
		});

		const captures = [
			makeCapture("cls.declaration", classNode),
			makeCapture("cls.name", nameNode),
			makeCapture("cls.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const result = parseClassCaptures(captures);

		expect(result).toHaveLength(1);
		expect(result[0]!.extends_name).toBeNull();
	});

	test("implements clause via heritage", () => {
		const classNode = makeNode({
			type: "class_declaration",
			startIndex: 0,
			endIndex: 50,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 2, column: 1 },
		});

		const nameNode = makeNode({
			type: "type_identifier",
			text: "ImplClass",
			startIndex: 6,
			endIndex: 15,
			startPosition: { row: 0, column: 6 },
			endPosition: { row: 0, column: 15 },
		});

		const implementsClause = makeNode({
			type: "implements_clause",
			text: "implements IFoo, IBar",
			namedChildren: [
				makeNode({
					type: "type_identifier",
					text: "IFoo",
					startIndex: 30,
					endIndex: 34,
					startPosition: { row: 0, column: 30 },
					endPosition: { row: 0, column: 34 },
				}),
				makeNode({
					type: "type_identifier",
					text: "IBar",
					startIndex: 36,
					endIndex: 40,
					startPosition: { row: 0, column: 36 },
					endPosition: { row: 0, column: 40 },
				}),
			],
		});

		const heritageNode = makeNode({
			type: "class_heritage",
			text: "implements IFoo, IBar",
			namedChildren: [implementsClause],
		});

		const bodyNode = makeNode({
			type: "class_body",
			startIndex: 45,
			endIndex: 50,
			startPosition: { row: 1, column: 0 },
			endPosition: { row: 2, column: 1 },
			namedChildren: [],
			children: [],
			parent: classNode,
		});

		(classNode as unknown as { namedChildren: Parser.Node[] }).namedChildren = [
			heritageNode,
			bodyNode,
		];

		const captures = [
			makeCapture("cls.declaration", classNode),
			makeCapture("cls.name", nameNode),
			makeCapture("cls.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const result = parseClassCaptures(captures);

		expect(result).toHaveLength(1);
		expect(result[0]!.implements).toEqual(["IFoo", "IBar"]);
	});

	test("no heritage means empty implements", () => {
		const classNode = makeNode({
			type: "class_declaration",
			startIndex: 0,
			endIndex: 20,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 0, column: 20 },
		});

		const nameNode = makeNode({
			type: "type_identifier",
			text: "Simple",
			startIndex: 6,
			endIndex: 12,
			startPosition: { row: 0, column: 6 },
			endPosition: { row: 0, column: 12 },
		});

		const bodyNode = makeNode({
			type: "class_body",
			startIndex: 13,
			endIndex: 20,
			startPosition: { row: 0, column: 13 },
			endPosition: { row: 0, column: 20 },
			namedChildren: [],
			children: [],
			parent: classNode,
		});

		(classNode as unknown as { namedChildren: Parser.Node[] }).namedChildren = [
			bodyNode,
		];

		const captures = [
			makeCapture("cls.declaration", classNode),
			makeCapture("cls.name", nameNode),
			makeCapture("cls.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const result = parseClassCaptures(captures);

		expect(result).toHaveLength(1);
		expect(result[0]!.implements).toEqual([]);
	});

	test("abstract keyword in declaration children", () => {
		const abstractKeyword = makeNode({
			type: "abstract",
			text: "abstract",
		});

		const classNode = makeNode({
			type: "class_declaration",
			startIndex: 0,
			endIndex: 25,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 0, column: 25 },
			children: [abstractKeyword],
		});

		const nameNode = makeNode({
			type: "type_identifier",
			text: "AbsBase",
			startIndex: 15,
			endIndex: 22,
			startPosition: { row: 0, column: 15 },
			endPosition: { row: 0, column: 22 },
		});

		const bodyNode = makeNode({
			type: "class_body",
			startIndex: 23,
			endIndex: 25,
			startPosition: { row: 0, column: 23 },
			endPosition: { row: 0, column: 25 },
			namedChildren: [],
			children: [],
			parent: classNode,
		});

		const captures = [
			makeCapture("cls.declaration", classNode),
			makeCapture("cls.name", nameNode),
			makeCapture("cls.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const result = parseClassCaptures(captures);

		expect(result).toHaveLength(1);
		expect(result[0]!.is_abstract).toBe(true);
	});

	test("abstract keyword in export statement parent", () => {
		const abstractKeyword = makeNode({
			type: "abstract",
			text: "abstract",
		});

		const exportNode = makeNode({
			type: "export_statement",
			startIndex: 0,
			endIndex: 30,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 0, column: 30 },
			children: [abstractKeyword],
		});

		const classNode = makeNode({
			type: "class_declaration",
			startIndex: 15,
			endIndex: 30,
			startPosition: { row: 0, column: 15 },
			endPosition: { row: 0, column: 30 },
			parent: exportNode,
		});

		(exportNode as unknown as { namedChildren: Parser.Node[] }).namedChildren =
			[classNode];

		const nameNode = makeNode({
			type: "type_identifier",
			text: "ExpAbs",
			startIndex: 21,
			endIndex: 27,
			startPosition: { row: 0, column: 21 },
			endPosition: { row: 0, column: 27 },
		});

		const bodyNode = makeNode({
			type: "class_body",
			startIndex: 28,
			endIndex: 30,
			startPosition: { row: 0, column: 28 },
			endPosition: { row: 0, column: 30 },
			namedChildren: [],
			children: [],
			parent: classNode,
		});

		const captures = [
			makeCapture("cls.export", exportNode),
			makeCapture("cls.name", nameNode),
			makeCapture("cls.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const result = parseClassCaptures(captures);

		expect(result).toHaveLength(1);
		expect(result[0]!.is_abstract).toBe(true);
	});

	test("non-abstract class", () => {
		const classNode = makeNode({
			type: "class_declaration",
			startIndex: 0,
			endIndex: 20,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 0, column: 20 },
			children: [],
		});

		const nameNode = makeNode({
			type: "type_identifier",
			text: "Concrete",
			startIndex: 6,
			endIndex: 14,
			startPosition: { row: 0, column: 6 },
			endPosition: { row: 0, column: 14 },
		});

		const bodyNode = makeNode({
			type: "class_body",
			startIndex: 15,
			endIndex: 20,
			startPosition: { row: 0, column: 15 },
			endPosition: { row: 0, column: 20 },
			namedChildren: [],
			children: [],
			parent: classNode,
		});

		const captures = [
			makeCapture("cls.declaration", classNode),
			makeCapture("cls.name", nameNode),
			makeCapture("cls.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const result = parseClassCaptures(captures);

		expect(result).toHaveLength(1);
		expect(result[0]!.is_abstract).toBe(false);
	});

	test("decorators via previousNamedSibling chain", () => {
		const decorator2 = makeNode({
			type: "decorator",
			text: "@Component",
			startIndex: 0,
			endIndex: 10,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 0, column: 10 },
		});

		const decorator1 = makeNode({
			type: "decorator",
			text: "@Injectable",
			startIndex: 11,
			endIndex: 22,
			startPosition: { row: 1, column: 0 },
			endPosition: { row: 1, column: 11 },
			previousNamedSibling: decorator2,
		});

		const classNode = makeNode({
			type: "class_declaration",
			startIndex: 23,
			endIndex: 50,
			startPosition: { row: 2, column: 0 },
			endPosition: { row: 2, column: 27 },
			previousNamedSibling: decorator1,
		});

		const nameNode = makeNode({
			type: "type_identifier",
			text: "Decorated",
			startIndex: 29,
			endIndex: 38,
			startPosition: { row: 2, column: 6 },
			endPosition: { row: 2, column: 15 },
		});

		const bodyNode = makeNode({
			type: "class_body",
			startIndex: 39,
			endIndex: 50,
			startPosition: { row: 2, column: 16 },
			endPosition: { row: 4, column: 1 },
			namedChildren: [],
			children: [],
			parent: classNode,
		});

		const captures = [
			makeCapture("cls.declaration", classNode),
			makeCapture("cls.name", nameNode),
			makeCapture("cls.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const result = parseClassCaptures(captures);

		expect(result).toHaveLength(1);
		expect(result[0]!.decorators).toEqual(["@Component", "@Injectable"]);
	});

	test("no decorators", () => {
		const classNode = makeNode({
			type: "class_declaration",
			startIndex: 0,
			endIndex: 20,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 0, column: 20 },
			previousNamedSibling: null,
		});

		const nameNode = makeNode({
			type: "type_identifier",
			text: "Plain",
			startIndex: 6,
			endIndex: 11,
			startPosition: { row: 0, column: 6 },
			endPosition: { row: 0, column: 11 },
		});

		const bodyNode = makeNode({
			type: "class_body",
			startIndex: 12,
			endIndex: 20,
			startPosition: { row: 0, column: 12 },
			endPosition: { row: 0, column: 20 },
			namedChildren: [],
			children: [],
			parent: classNode,
		});

		const captures = [
			makeCapture("cls.declaration", classNode),
			makeCapture("cls.name", nameNode),
			makeCapture("cls.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const result = parseClassCaptures(captures);

		expect(result).toHaveLength(1);
		expect(result[0]!.decorators).toEqual([]);
	});

	test("method extraction with async and complexity", () => {
		const asyncKeyword = makeNode({
			type: "async",
			text: "async",
		});

		const ifStatement = makeNode({
			type: "if_statement",
			text: "if (x) {}",
			children: [],
			namedChildren: [],
		});

		const methodBody = makeNode({
			type: "statement_block",
			text: "{ if (x) {} }",
			children: [ifStatement],
			namedChildren: [ifStatement],
		});

		const methodName = makeNode({
			type: "property_identifier",
			text: "asyncMethod",
		});

		const methodNode = makeNode({
			type: "method_definition",
			text: "async asyncMethod() { if (x) {} }",
			startIndex: 10,
			endIndex: 50,
			startPosition: { row: 1, column: 2 },
			endPosition: { row: 3, column: 3 },
			children: [asyncKeyword],
			namedChildren: [],
		});

		methodNode.childForFieldName = (name: string): Parser.Node | null => {
			if (name === "name") return methodName;
			if (name === "body") return methodBody;
			return null;
		};

		const normalMethodName = makeNode({
			type: "property_identifier",
			text: "normalMethod",
		});

		const normalMethodBody = makeNode({
			type: "statement_block",
			text: "{}",
			children: [],
			namedChildren: [],
		});

		const normalMethodNode = makeNode({
			type: "method_definition",
			text: "normalMethod() {}",
			startIndex: 60,
			endIndex: 85,
			startPosition: { row: 4, column: 2 },
			endPosition: { row: 4, column: 27 },
			children: [],
			namedChildren: [],
		});

		normalMethodNode.childForFieldName = (name: string): Parser.Node | null => {
			if (name === "name") return normalMethodName;
			if (name === "body") return normalMethodBody;
			return null;
		};

		const classNode = makeNode({
			type: "class_declaration",
			startIndex: 0,
			endIndex: 100,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 5, column: 1 },
		});

		const nameNode = makeNode({
			type: "type_identifier",
			text: "WithMethods",
			startIndex: 6,
			endIndex: 17,
			startPosition: { row: 0, column: 6 },
			endPosition: { row: 0, column: 17 },
		});

		const bodyNode = makeNode({
			type: "class_body",
			startIndex: 18,
			endIndex: 100,
			startPosition: { row: 0, column: 18 },
			endPosition: { row: 5, column: 1 },
			namedChildren: [methodNode, normalMethodNode],
			children: [],
			parent: classNode,
		});

		const captures = [
			makeCapture("cls.declaration", classNode),
			makeCapture("cls.name", nameNode),
			makeCapture("cls.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const result = parseClassCaptures(captures);

		expect(result).toHaveLength(1);
		expect(result[0]!.methods).toHaveLength(2);
		expect(result[0]!.methods[0]!.name).toBe("asyncMethod");
		expect(result[0]!.methods[0]!.is_async).toBe(true);
		expect(result[0]!.methods[0]!.cyclomatic_complexity).toBe(2);
		expect(result[0]!.methods[0]!.line).toBe(2);
		expect(result[0]!.methods[1]!.name).toBe("normalMethod");
		expect(result[0]!.methods[1]!.is_async).toBe(false);
		expect(result[0]!.methods[1]!.cyclomatic_complexity).toBe(1);
	});

	test("property counting with public_field_definition", () => {
		const field1 = makeNode({
			type: "public_field_definition",
			text: "foo: string",
		});

		const field2 = makeNode({
			type: "public_field_definition",
			text: "bar: number",
		});

		const field3 = makeNode({
			type: "public_field_definition",
			text: "baz: boolean",
		});

		const classNode = makeNode({
			type: "class_declaration",
			startIndex: 0,
			endIndex: 80,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 4, column: 1 },
		});

		const nameNode = makeNode({
			type: "type_identifier",
			text: "WithProps",
			startIndex: 6,
			endIndex: 15,
			startPosition: { row: 0, column: 6 },
			endPosition: { row: 0, column: 15 },
		});

		const bodyNode = makeNode({
			type: "class_body",
			startIndex: 16,
			endIndex: 80,
			startPosition: { row: 0, column: 16 },
			endPosition: { row: 4, column: 1 },
			namedChildren: [field1, field2, field3],
			children: [],
			parent: classNode,
		});

		const captures = [
			makeCapture("cls.declaration", classNode),
			makeCapture("cls.name", nameNode),
			makeCapture("cls.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const result = parseClassCaptures(captures);

		expect(result).toHaveLength(1);
		expect(result[0]!.property_count).toBe(3);
	});

	test("property counting with field_definition", () => {
		const field1 = makeNode({
			type: "field_definition",
			text: "x = 1",
		});

		const classNode = makeNode({
			type: "class_declaration",
			startIndex: 0,
			endIndex: 30,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 2, column: 1 },
		});

		const nameNode = makeNode({
			type: "type_identifier",
			text: "FieldClass",
			startIndex: 6,
			endIndex: 16,
			startPosition: { row: 0, column: 6 },
			endPosition: { row: 0, column: 16 },
		});

		const bodyNode = makeNode({
			type: "class_body",
			startIndex: 17,
			endIndex: 30,
			startPosition: { row: 0, column: 17 },
			endPosition: { row: 2, column: 1 },
			namedChildren: [field1],
			children: [],
			parent: classNode,
		});

		const captures = [
			makeCapture("cls.declaration", classNode),
			makeCapture("cls.name", nameNode),
			makeCapture("cls.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const result = parseClassCaptures(captures);

		expect(result).toHaveLength(1);
		expect(result[0]!.property_count).toBe(1);
	});

	test("empty body has zero properties", () => {
		const classNode = makeNode({
			type: "class_declaration",
			startIndex: 0,
			endIndex: 15,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 0, column: 15 },
		});

		const nameNode = makeNode({
			type: "type_identifier",
			text: "Empty",
			startIndex: 6,
			endIndex: 11,
			startPosition: { row: 0, column: 6 },
			endPosition: { row: 0, column: 11 },
		});

		const bodyNode = makeNode({
			type: "class_body",
			startIndex: 12,
			endIndex: 15,
			startPosition: { row: 0, column: 12 },
			endPosition: { row: 0, column: 15 },
			namedChildren: [],
			children: [],
			parent: classNode,
		});

		const captures = [
			makeCapture("cls.declaration", classNode),
			makeCapture("cls.name", nameNode),
			makeCapture("cls.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const result = parseClassCaptures(captures);

		expect(result).toHaveLength(1);
		expect(result[0]!.property_count).toBe(0);
	});

	test("missing name capture skips class", () => {
		const classNode = makeNode({
			type: "class_declaration",
			startIndex: 0,
			endIndex: 15,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 0, column: 15 },
		});

		const bodyNode = makeNode({
			type: "class_body",
			startIndex: 10,
			endIndex: 15,
			startPosition: { row: 0, column: 10 },
			endPosition: { row: 0, column: 15 },
			namedChildren: [],
			children: [],
			parent: classNode,
		});

		const captures = [
			makeCapture("cls.declaration", classNode),
			makeCapture("cls.body", bodyNode),
		] as unknown as Parser.QueryCapture[];

		const result = parseClassCaptures(captures);

		expect(result).toHaveLength(0);
	});

	test("missing body capture skips class", () => {
		const classNode = makeNode({
			type: "class_declaration",
			startIndex: 0,
			endIndex: 15,
			startPosition: { row: 0, column: 0 },
			endPosition: { row: 0, column: 15 },
		});

		const nameNode = makeNode({
			type: "type_identifier",
			text: "NoBody",
			startIndex: 6,
			endIndex: 12,
			startPosition: { row: 0, column: 6 },
			endPosition: { row: 0, column: 12 },
		});

		const captures = [
			makeCapture("cls.declaration", classNode),
			makeCapture("cls.name", nameNode),
		] as unknown as Parser.QueryCapture[];

		const result = parseClassCaptures(captures);

		expect(result).toHaveLength(0);
	});
});
