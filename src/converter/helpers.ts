/**
 * Helper functions for SCIP to database conversion
 */

/**
 * SCIP Symbol Kind mappings (complete set from SCIP protobuf)
 * Reference: https://github.com/sourcegraph/scip/blob/main/scip.proto
 *
 * Maps all 87 SCIP kinds to simplified category strings for database storage.
 * Similar kinds are grouped together (e.g., all method variants → "method").
 */
const SymbolKind: Record<number, string> = {
	// Unknown
	0: "unknown",

	// Primitives
	1: "array",
	6: "boolean",
	8: "constant",
	31: "null",
	32: "number",
	48: "string",

	// Classes & Types
	7: "class",
	54: "type",
	55: "type_alias",
	56: "type_class",
	57: "type_family",
	58: "type_parameter",
	75: "class", // SingletonClass

	// Constructors
	9: "constructor",

	// Enums
	11: "enum",
	12: "enum_member",

	// Fields & Properties
	15: "field",
	41: "property",
	79: "field", // StaticField
	81: "property", // StaticProperty
	77: "field", // StaticDataMember

	// Functions
	17: "function",

	// Methods (all variants)
	26: "method",
	66: "method", // AbstractMethod
	67: "method", // MethodSpecification
	68: "method", // ProtocolMethod
	69: "method", // PureVirtualMethod
	70: "method", // TraitMethod
	71: "method", // TypeClassMethod
	74: "method", // MethodAlias
	76: "method", // SingletonMethod
	80: "method", // StaticMethod

	// Getters & Setters
	18: "getter",
	45: "setter",
	72: "accessor",
	47: "subscript",

	// Variables
	61: "variable",
	82: "variable", // StaticVariable

	// Parameters
	37: "parameter",
	38: "parameter", // ParameterLabel
	44: "parameter", // SelfParameter
	52: "parameter", // ThisParameter
	27: "parameter", // MethodReceiver

	// Interfaces & Protocols
	21: "interface",
	42: "protocol",
	53: "trait",

	// Structs
	49: "struct",
	59: "union",

	// Modules & Namespaces
	29: "module",
	30: "namespace",
	64: "library",

	// Packages
	35: "package",
	36: "package", // PackageObject

	// Events
	13: "event",
	78: "event", // StaticEvent

	// Macros
	25: "macro",

	// Special constructs
	2: "assertion",
	3: "type", // AssociatedType
	4: "attribute",
	5: "axiom",
	10: "type", // DataFamily
	14: "fact",
	16: "file",
	19: "grammar",
	20: "instance",
	22: "key",
	23: "lang",
	24: "lemma",
	28: "message",
	33: "object",
	34: "operator",
	39: "pattern",
	40: "predicate",
	43: "quasiquoter",
	46: "signature",
	50: "tactic",
	51: "theorem",
	60: "value",
	62: "contract",
	63: "error",
	65: "modifier",
	73: "delegate",
	84: "extension",
	85: "mixin",
	86: "concept",
};

/**
 * Convert SCIP symbol kind (integer) to string
 */
export function symbolKindToString(kind: number | null): string {
	if (kind === null || kind === undefined) {
		return "unknown";
	}
	return SymbolKind[kind] || "unknown";
}

/**
 * Extract package name from SCIP symbol string
 *
 * SCIP symbol format examples:
 * - scip-typescript npm @package/name 1.0.0 src/`file.ts`/Symbol#
 * - scip-java maven org.example artifact 1.0.0 com/example/Class#
 * - scip-go go github.com/user/repo pkg/Module#
 *
 * @param scipSymbol Full SCIP symbol string
 * @returns Package name or null if not found
 */
export function extractPackageFromScip(
	scipSymbol: string | null,
): string | null {
	if (!scipSymbol) return null;

	// NPM packages
	const npmMatch = scipSymbol.match(/npm\s+(@?[\w\-@/.]+)\s+/);
	if (npmMatch && npmMatch[1]) {
		return npmMatch[1];
	}

	// Maven packages
	const mavenMatch = scipSymbol.match(/maven\s+([\w.-]+)\s+([\w.-]+)\s+/);
	if (mavenMatch && mavenMatch[1] && mavenMatch[2]) {
		return `${mavenMatch[1]}:${mavenMatch[2]}`;
	}

	// Go packages
	const goMatch = scipSymbol.match(/go\s+([\w.\-/]+)\s+/);
	if (goMatch && goMatch[1]) {
		return goMatch[1];
	}

	return null;
}

/**
 * Extract display name from SCIP symbol if display_name is null
 *
 * @param scipSymbol Full SCIP symbol string
 * @returns Symbol name
 */
export function extractNameFromScip(scipSymbol: string): string {
	if (!scipSymbol) return "unknown";

	// Extract the last segment after the last `/` and before `#`
	const match = scipSymbol.match(/\/([^/`]+)#/);
	if (match && match[1]) {
		return match[1];
	}

	// Fallback: return last segment
	const segments = scipSymbol.split("/");
	const lastSegment = segments[segments.length - 1];
	if (!lastSegment) return "unknown";
	return lastSegment.replace(/#.*$/, "");
}

/**
 * Infer package manager from SCIP symbol
 *
 * @param scipSymbol Full SCIP symbol string
 * @returns Package manager type
 */
export function inferPackageManager(scipSymbol: string | null): string {
	if (!scipSymbol) return "unknown";

	if (scipSymbol.includes(" npm ")) return "npm";
	if (scipSymbol.includes(" maven ")) return "maven";
	if (scipSymbol.includes(" go ")) return "go";
	if (scipSymbol.includes(" cargo ")) return "cargo";

	return "unknown";
}

/**
 * Extract symbol kind from documentation string
 *
 * scip-typescript doesn't set the kind field, but embeds it in documentation.
 * Examples:
 * - "interface IndexState"
 * - "(property) gitCommit: string"
 * - "function getFileCount(db: Database): number"
 * - "class CtxError"
 * - "(method) toString(): string"
 * - "type MyType = ..."
 * - "(parameter) db: Database"
 * - "module \"file.ts\""
 * - "const MY_CONST = ..."
 * - "let myVar = ..."
 * - "var oldVar = ..."
 * - "enum MyEnum"
 * - "(enum member) Value"
 *
 * @param documentation Documentation lines array
 * @returns Symbol kind string
 */
export function extractKindFromDocumentation(
	documentation: string[] | undefined,
): string {
	if (!documentation || documentation.length === 0) {
		return "unknown";
	}

	// Join all documentation lines and clean up
	const fullDoc = documentation.join("\n").trim();

	// Strip code fences (```ts, ```typescript, etc.)
	const cleanedDoc = fullDoc
		.replace(/^```[a-z]*\s*\n/i, "") // Remove opening fence
		.replace(/\n```\s*$/i, "") // Remove closing fence
		.trim();

	// Get first non-empty line (usually contains the signature)
	const lines = cleanedDoc.split("\n").filter((l) => l.trim().length > 0);
	if (lines.length === 0) return "unknown";

	const firstLine = lines[0]!.trim();

	// Match patterns in parentheses: "(property)", "(method)", "(parameter)", etc.
	const parenMatch = firstLine.match(/^\(([^)]+)\)/);
	if (parenMatch && parenMatch[1]) {
		const kind = parenMatch[1].toLowerCase();
		// Handle compound kinds like "enum member"
		if (kind.includes("enum member")) return "enum_member";
		if (kind.includes("member")) return "property";
		// Return the matched kind
		return kind;
	}

	// Match standalone keywords at start: "interface", "class", "function", "type", etc.
	const keywords = [
		"interface",
		"class",
		"function",
		"type",
		"enum",
		"const",
		"let",
		"var",
		"module",
		"namespace",
		"struct",
		"trait",
		"constructor",
	];

	for (const keyword of keywords) {
		if (firstLine.startsWith(keyword + " ")) {
			// Handle special cases
			if (keyword === "const" || keyword === "let" || keyword === "var") {
				return "variable";
			}
			if (keyword === "type") {
				// Distinguish "type" from "type alias"
				if (firstLine.includes(" = ")) {
					return "type_alias";
				}
				return "type";
			}
			return keyword;
		}
	}

	// Check for constructor pattern: "new ClassName(...)"
	if (firstLine.startsWith("new ") || firstLine.includes("constructor(")) {
		return "constructor";
	}

	// Default
	return "unknown";
}
