import type Parser from "web-tree-sitter";
import type {
	ClassInfo,
	FunctionInfo,
	MethodInfo,
} from "../../schemas/treesitter.ts";

export const functionQueryString = `
(function_declaration
  name: (identifier) @fn.name
  parameters: (formal_parameters) @fn.params
  return_type: (type_annotation)? @fn.return_type
  body: (statement_block) @fn.body) @fn.declaration

(export_statement
  declaration: (function_declaration
    name: (identifier) @fn.name
    parameters: (formal_parameters) @fn.params
    return_type: (type_annotation)? @fn.return_type
    body: (statement_block) @fn.body)) @fn.export

(export_statement
  declaration: (generator_function_declaration
    name: (identifier) @fn.name
    parameters: (formal_parameters) @fn.params
    return_type: (type_annotation)? @fn.return_type
    body: (statement_block) @fn.body)) @fn.export

(generator_function_declaration
  name: (identifier) @fn.name
  parameters: (formal_parameters) @fn.params
  return_type: (type_annotation)? @fn.return_type
  body: (statement_block) @fn.body) @fn.declaration

(lexical_declaration
  (variable_declarator
    name: (identifier) @fn.name
    value: (arrow_function
      parameters: (formal_parameters) @fn.params
      return_type: (type_annotation)? @fn.return_type
      body: (_) @fn.body))) @fn.arrow

(export_statement
  declaration: (lexical_declaration
    (variable_declarator
      name: (identifier) @fn.name
      value: (arrow_function
        parameters: (formal_parameters) @fn.params
        return_type: (type_annotation)? @fn.return_type
        body: (_) @fn.body)))) @fn.export_arrow

(method_definition
  name: (property_identifier) @fn.name
  parameters: (formal_parameters) @fn.params
  return_type: (type_annotation)? @fn.return_type
  body: (statement_block) @fn.body) @fn.method
`;

export const classQueryString = `
(class_declaration
  name: (type_identifier) @cls.name
  (class_heritage
    (extends_clause
      value: (_) @cls.extends))?
  body: (class_body) @cls.body) @cls.declaration

(export_statement
  declaration: (class_declaration
    name: (type_identifier) @cls.name
    (class_heritage
      (extends_clause
        value: (_) @cls.extends))?
    body: (class_body) @cls.body)) @cls.export
`;

const COMPLEXITY_NODE_TYPES = new Set([
	"if_statement",
	"ternary_expression",
	"for_statement",
	"for_in_statement",
	"while_statement",
	"do_statement",
	"catch_clause",
]);

function countComplexity(bodyNode: Parser.Node): number {
	let count = 1;

	function walk(node: Parser.Node): void {
		if (COMPLEXITY_NODE_TYPES.has(node.type)) {
			count++;
		} else if (node.type === "switch_case") {
			const firstChild = node.firstChild;
			if (firstChild && firstChild.type !== "default") {
				count++;
			}
		} else if (node.type === "binary_expression") {
			const operatorNode = node.childForFieldName("operator");
			if (
				operatorNode &&
				(operatorNode.text === "&&" ||
					operatorNode.text === "||" ||
					operatorNode.text === "??")
			) {
				count++;
			}
		}

		for (const child of node.children) {
			walk(child);
		}
	}

	walk(bodyNode);
	return count;
}

function extractParameters(
	paramsNode: Parser.Node,
): Array<{ name: string; type: string | null }> {
	const params: Array<{ name: string; type: string | null }> = [];

	for (const child of paramsNode.namedChildren) {
		if (
			child.type === "identifier" ||
			child.type === "shorthand_property_identifier_pattern"
		) {
			params.push({ name: child.text, type: null });
		} else if (
			child.type === "required_parameter" ||
			child.type === "optional_parameter"
		) {
			const nameNode =
				child.childForFieldName("pattern") || child.childForFieldName("name");
			const typeNode = child.childForFieldName("type");
			if (nameNode) {
				let paramName = nameNode.text;
				if (nameNode.type === "assignment_pattern") {
					const leftNode = nameNode.childForFieldName("left");
					if (leftNode) paramName = leftNode.text;
				}
				params.push({
					name: paramName,
					type: typeNode ? typeNode.text.replace(/^:\s*/, "") : null,
				});
			}
		} else if (child.type === "rest_pattern" || child.type === "rest_element") {
			const innerNode = child.namedChildren[0];
			if (innerNode) {
				params.push({ name: `...${innerNode.text}`, type: null });
			}
		} else if (child.type === "assignment_pattern") {
			const leftNode = child.childForFieldName("left");
			if (leftNode) {
				params.push({ name: leftNode.text, type: null });
			}
		}
	}

	return params;
}

function findPrecedingJsdoc(node: Parser.Node): string | null {
	let sibling = node.previousNamedSibling;
	if (sibling && sibling.type === "comment") {
		const text = sibling.text;
		if (text.startsWith("/**")) {
			return text;
		}
	}
	return null;
}

function isAsyncFunction(node: Parser.Node): boolean {
	for (const child of node.children) {
		if (child.type === "async") return true;
	}
	return false;
}

export function parseFunctionCaptures(
	captures: Parser.QueryCapture[],
): FunctionInfo[] {
	const seen = new Set<number>();
	const results: FunctionInfo[] = [];

	const declarationCaptures = captures.filter(
		(c) =>
			c.name === "fn.declaration" ||
			c.name === "fn.export" ||
			c.name === "fn.arrow" ||
			c.name === "fn.export_arrow" ||
			c.name === "fn.method",
	);

	for (const capture of declarationCaptures) {
		const declarationNode = capture.node;

		let fnNode = declarationNode;
		if (capture.name === "fn.export" || capture.name === "fn.export_arrow") {
			const inner =
				fnNode.childForFieldName("declaration") ||
				fnNode.namedChildren.find(
					(c) =>
						c.type === "function_declaration" ||
						c.type === "generator_function_declaration" ||
						c.type === "lexical_declaration",
				);
			if (inner) fnNode = inner;
		}

		if (fnNode.type === "lexical_declaration") {
			const declarator = fnNode.namedChildren.find(
				(c) => c.type === "variable_declarator",
			);
			if (declarator) fnNode = declarator;
		}

		if (seen.has(declarationNode.startIndex)) continue;
		seen.add(declarationNode.startIndex);

		const nameCapture = captures.find(
			(c) =>
				c.name === "fn.name" &&
				c.node.startIndex >= declarationNode.startIndex &&
				c.node.endIndex <= declarationNode.endIndex,
		);
		const paramsCapture = captures.find(
			(c) =>
				c.name === "fn.params" &&
				c.node.startIndex >= declarationNode.startIndex &&
				c.node.endIndex <= declarationNode.endIndex,
		);
		const bodyCapture = captures.find(
			(c) =>
				c.name === "fn.body" &&
				c.node.startIndex >= declarationNode.startIndex &&
				c.node.endIndex <= declarationNode.endIndex,
		);
		const returnCapture = captures.find(
			(c) =>
				c.name === "fn.return_type" &&
				c.node.startIndex >= declarationNode.startIndex &&
				c.node.endIndex <= declarationNode.endIndex,
		);

		if (!nameCapture || !paramsCapture || !bodyCapture) continue;

		const name = nameCapture.node.text;
		const startLine = declarationNode.startPosition.row + 1;
		const endLine = declarationNode.endPosition.row + 1;
		const loc = endLine - startLine + 1;

		const isMethod = capture.name === "fn.method";
		const isExported =
			capture.name === "fn.export" || capture.name === "fn.export_arrow";
		const isAsync = isAsyncFunction(
			fnNode.type === "variable_declarator"
				? (fnNode.namedChildren.find((c) => c.type === "arrow_function") ??
						fnNode)
				: fnNode,
		);

		const parameters = extractParameters(paramsCapture.node);
		const returnType = returnCapture
			? returnCapture.node.text.replace(/^:\s*/, "")
			: null;
		const jsdoc = findPrecedingJsdoc(declarationNode);
		const complexity = countComplexity(bodyCapture.node);

		results.push({
			name,
			lines: [startLine, endLine],
			loc,
			cyclomatic_complexity: complexity,
			parameters,
			return_type: returnType,
			is_async: isAsync,
			is_exported: isExported,
			is_method: isMethod,
			jsdoc,
		});
	}

	return results;
}

function extractImplements(bodyNode: Parser.Node): string[] {
	const parent = bodyNode.parent;
	if (!parent) return [];

	const heritage = parent.namedChildren.find(
		(c) => c.type === "class_heritage",
	);
	if (!heritage) return [];

	const result: string[] = [];
	for (const child of heritage.namedChildren) {
		if (child.type === "implements_clause") {
			for (const type of child.namedChildren) {
				if (type.type !== "implements") {
					result.push(type.text);
				}
			}
		}
	}
	return result;
}

function extractDecorators(declarationNode: Parser.Node): string[] {
	const decorators: string[] = [];
	let sibling = declarationNode.previousNamedSibling;
	while (sibling && sibling.type === "decorator") {
		decorators.unshift(sibling.text);
		sibling = sibling.previousNamedSibling;
	}
	const parent = declarationNode.parent;
	if (parent) {
		for (const child of parent.namedChildren) {
			if (
				child.type === "decorator" &&
				child.endIndex < declarationNode.startIndex
			) {
				if (!decorators.includes(child.text)) {
					decorators.push(child.text);
				}
			}
		}
	}
	return decorators;
}

function isAbstractClass(declarationNode: Parser.Node): boolean {
	for (const child of declarationNode.children) {
		if (child.type === "abstract") return true;
	}
	const parent = declarationNode.parent;
	if (parent?.type === "export_statement") {
		for (const child of parent.children) {
			if (child.type === "abstract") return true;
		}
	}
	return false;
}

function extractMethods(bodyNode: Parser.Node): MethodInfo[] {
	const methods: MethodInfo[] = [];

	for (const child of bodyNode.namedChildren) {
		if (child.type === "method_definition") {
			const nameNode = child.childForFieldName("name");
			const methodBodyNode = child.childForFieldName("body");
			if (!nameNode || !methodBodyNode) continue;

			const isAsync = isAsyncFunction(child);
			const complexity = countComplexity(methodBodyNode);

			methods.push({
				name: nameNode.text,
				line: child.startPosition.row + 1,
				is_async: isAsync,
				cyclomatic_complexity: complexity,
			});
		}
	}

	return methods;
}

function countProperties(bodyNode: Parser.Node): number {
	let count = 0;
	for (const child of bodyNode.namedChildren) {
		if (
			child.type === "public_field_definition" ||
			child.type === "field_definition"
		) {
			count++;
		}
	}
	return count;
}

export function parseClassCaptures(
	captures: Parser.QueryCapture[],
): ClassInfo[] {
	const seen = new Set<number>();
	const results: ClassInfo[] = [];

	const declarationCaptures = captures.filter(
		(c) => c.name === "cls.declaration" || c.name === "cls.export",
	);

	for (const capture of declarationCaptures) {
		const declarationNode = capture.node;

		if (seen.has(declarationNode.startIndex)) continue;
		seen.add(declarationNode.startIndex);

		let classNode = declarationNode;
		if (capture.name === "cls.export") {
			const inner = classNode.namedChildren.find(
				(c) => c.type === "class_declaration",
			);
			if (inner) classNode = inner;
		}

		const nameCapture = captures.find(
			(c) =>
				c.name === "cls.name" &&
				c.node.startIndex >= declarationNode.startIndex &&
				c.node.endIndex <= declarationNode.endIndex,
		);
		const bodyCapture = captures.find(
			(c) =>
				c.name === "cls.body" &&
				c.node.startIndex >= declarationNode.startIndex &&
				c.node.endIndex <= declarationNode.endIndex,
		);
		const extendsCapture = captures.find(
			(c) =>
				c.name === "cls.extends" &&
				c.node.startIndex >= declarationNode.startIndex &&
				c.node.endIndex <= declarationNode.endIndex,
		);

		if (!nameCapture || !bodyCapture) continue;

		const name = nameCapture.node.text;
		const startLine = declarationNode.startPosition.row + 1;
		const endLine = declarationNode.endPosition.row + 1;
		const extendsName = extendsCapture ? extendsCapture.node.text : null;
		const implementsList = extractImplements(bodyCapture.node);
		const decorators = extractDecorators(classNode);
		const isAbstract = isAbstractClass(classNode);
		const methods = extractMethods(bodyCapture.node);
		const propertyCount = countProperties(bodyCapture.node);

		results.push({
			name,
			lines: [startLine, endLine],
			extends_name: extendsName,
			implements: implementsList,
			decorators,
			is_abstract: isAbstract,
			methods,
			property_count: propertyCount,
		});
	}

	return results;
}
