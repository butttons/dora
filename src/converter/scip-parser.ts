/**
 * SCIP Protobuf Parser
 * Parses SCIP protobuf files directly without the intermediate SCIP DB conversion.
 */

import { fromBinary } from "@bufbuild/protobuf";
import {
	type Document,
	Index,
	IndexSchema,
	type Occurrence,
	type SymbolInformation,
	SymbolRole,
} from "./scip_pb.js";

/**
 * Parsed SCIP data structure
 */
export interface ScipData {
	documents: ParsedDocument[];
	externalSymbols: ParsedSymbol[];
	metadata?: {
		toolName?: string;
		toolVersion?: string;
		projectRoot?: string;
	};
}

/**
 * Parsed document with all its symbols and occurrences
 */
export interface ParsedDocument {
	relativePath: string;
	language: string;
	occurrences: ParsedOccurrence[];
	symbols: ParsedSymbol[];
}

/**
 * Parsed occurrence (symbol reference or definition)
 */
export interface ParsedOccurrence {
	range: [number, number, number, number]; // [startLine, startChar, endLine, endChar]
	symbol: string; // Full SCIP identifier
	symbolRoles: number; // Bitset: 0x1 = definition, 0x2 = import, etc.
	enclosingRange?: [number, number, number, number];
}

/**
 * Parsed symbol information
 */
export interface ParsedSymbol {
	symbol: string; // Full SCIP identifier
	displayName?: string;
	kind: number;
	documentation?: string[];
	relationships?: ParsedRelationship[];
	enclosingSymbol?: string;
}

/**
 * Symbol relationship (inheritance, implementation, etc.)
 */
export interface ParsedRelationship {
	symbol: string;
	isReference: boolean;
	isImplementation: boolean;
	isTypeDefinition: boolean;
	isDefinition: boolean;
}

/**
 * Symbol definition extracted from occurrences
 */
export interface SymbolDefinition {
	symbol: string;
	range: [number, number, number, number];
	enclosingRange?: [number, number, number, number];
}

/**
 * Symbol reference extracted from occurrences
 */
export interface SymbolReference {
	symbol: string;
	range: [number, number, number, number];
	line: number;
}

/**
 * Parses a SCIP (Source Code Intelligence Protocol) protobuf file.
 *
 * Reads the binary .scip file and deserializes it using the @bufbuild/protobuf library.
 * Extracts documents, symbols, and metadata from the SCIP index.
 *
 * @param scipPath - Absolute or relative path to the .scip file
 * @returns Parsed SCIP data containing documents, external symbols, and metadata
 * @throws {Error} If the file cannot be read or parsed as valid SCIP protobuf
 */
export async function parseScipFile(scipPath: string): Promise<ScipData> {
	// Read the binary file
	const file = Bun.file(scipPath);
	const buffer = await file.arrayBuffer();
	const uint8Array = new Uint8Array(buffer);

	// Parse the protobuf
	const index = fromBinary(IndexSchema, uint8Array);

	// Extract metadata
	const metadata = index.metadata
		? {
				toolName: index.metadata.toolInfo?.name,
				toolVersion: index.metadata.toolInfo?.version,
				projectRoot: index.metadata.projectRoot,
			}
		: undefined;

	// Parse documents
	const documents: ParsedDocument[] = index.documents.map((doc) =>
		parseDocument(doc),
	);

	// Parse external symbols
	const externalSymbols: ParsedSymbol[] = index.externalSymbols.map((sym) =>
		parseSymbol(sym),
	);

	return {
		documents,
		externalSymbols,
		metadata,
	};
}

/**
 * Parse a SCIP Document into our format
 */
function parseDocument(doc: Document): ParsedDocument {
	return {
		relativePath: doc.relativePath,
		language: doc.language,
		occurrences: doc.occurrences.map((occ) => parseOccurrence(occ)),
		symbols: doc.symbols.map((sym) => parseSymbol(sym)),
	};
}

/**
 * Parse a SCIP Occurrence into our format
 */
function parseOccurrence(occ: Occurrence): ParsedOccurrence {
	// Parse range: can be 3 or 4 elements
	let range: [number, number, number, number];
	if (occ.range.length === 3) {
		// [startLine, startChar, endChar] - same line
		range = [occ.range[0], occ.range[1], occ.range[0], occ.range[2]];
	} else if (occ.range.length === 4) {
		// [startLine, startChar, endLine, endChar]
		range = [occ.range[0], occ.range[1], occ.range[2], occ.range[3]];
	} else {
		throw new Error(`Invalid range format: ${occ.range}`);
	}

	// Parse enclosing range if present
	let enclosingRange: [number, number, number, number] | undefined;
	if (occ.enclosingRange && occ.enclosingRange.length > 0) {
		if (occ.enclosingRange.length === 3) {
			enclosingRange = [
				occ.enclosingRange[0],
				occ.enclosingRange[1],
				occ.enclosingRange[0],
				occ.enclosingRange[2],
			];
		} else if (occ.enclosingRange.length === 4) {
			enclosingRange = [
				occ.enclosingRange[0],
				occ.enclosingRange[1],
				occ.enclosingRange[2],
				occ.enclosingRange[3],
			];
		}
	}

	return {
		range,
		symbol: occ.symbol,
		symbolRoles: occ.symbolRoles,
		enclosingRange,
	};
}

/**
 * Parse a SCIP SymbolInformation into our format
 */
function parseSymbol(sym: SymbolInformation): ParsedSymbol {
	return {
		symbol: sym.symbol,
		displayName: sym.displayName || undefined,
		kind: sym.kind,
		documentation: sym.documentation.length > 0 ? sym.documentation : undefined,
		relationships: sym.relationships.map((rel) => ({
			symbol: rel.symbol,
			isReference: rel.isReference,
			isImplementation: rel.isImplementation,
			isTypeDefinition: rel.isTypeDefinition,
			isDefinition: rel.isDefinition,
		})),
	};
}

/**
 * Extract symbol definitions from a document's occurrences
 * A definition is an occurrence where the Definition bit (0x1) is set in symbolRoles
 */
export function extractDefinitions(doc: ParsedDocument): SymbolDefinition[] {
	const definitions: SymbolDefinition[] = [];

	for (const occ of doc.occurrences) {
		// Check if the Definition bit is set (symbolRoles & 0x1)
		if (occ.symbolRoles & SymbolRole.Definition) {
			definitions.push({
				symbol: occ.symbol,
				range: occ.range,
				enclosingRange: occ.enclosingRange,
			});
		}
	}

	return definitions;
}

/**
 * Extract symbol references from a document's occurrences
 * A reference is an occurrence where the Definition bit is NOT set
 */
export function extractReferences(doc: ParsedDocument): SymbolReference[] {
	const references: SymbolReference[] = [];

	for (const occ of doc.occurrences) {
		// Check if this is NOT a definition (symbolRoles & 0x1 == 0)
		if (!(occ.symbolRoles & SymbolRole.Definition)) {
			references.push({
				symbol: occ.symbol,
				range: occ.range,
				line: occ.range[0], // Start line
			});
		}
	}

	return references;
}

/**
 * Find which file defines a symbol
 * @param symbol SCIP symbol identifier
 * @param documents Map of relativePath -> ParsedDocument
 * @param symbols Map of symbol -> ParsedSymbol (includes external symbols)
 * @returns The relative path of the file where the symbol is defined, or null if not found
 */
export function findDefinitionFile(
	symbol: string,
	documents: Map<string, ParsedDocument>,
	symbols: Map<string, ParsedSymbol>,
): string | null {
	// First, check if it's a local symbol (contains 'local')
	if (symbol.includes("local")) {
		// Local symbols are defined in the same file they're used in
		// We need to search through all documents to find where it's defined
		for (const [path, doc] of documents) {
			const definitions = extractDefinitions(doc);
			if (definitions.some((def) => def.symbol === symbol)) {
				return path;
			}
		}
		return null;
	}

	// For non-local symbols, search through all documents
	for (const [path, doc] of documents) {
		// Check if this document has a definition for the symbol
		const definitions = extractDefinitions(doc);
		if (definitions.some((def) => def.symbol === symbol)) {
			return path;
		}

		// Also check document-level symbols
		if (doc.symbols.some((sym) => sym.symbol === symbol)) {
			return path;
		}
	}

	// Symbol might be external (defined in another index/package)
	// External symbols don't have a definition file in this index
	return null;
}

/**
 * Builds lookup maps for efficient querying of SCIP data.
 *
 * Creates indexed data structures to enable O(1) lookups for:
 * - Documents by file path
 * - Symbols by SCIP identifier
 * - Symbol definitions by symbol identifier
 *
 * @param scipData - Parsed SCIP data from parseScipFile
 * @returns Object containing three lookup maps for fast queries
 */
export function buildLookupMaps(scipData: ScipData): {
	documentsByPath: Map<string, ParsedDocument>;
	symbolsById: Map<string, ParsedSymbol>;
	definitionsBySymbol: Map<
		string,
		{ file: string; definition: SymbolDefinition }
	>;
} {
	const documentsByPath = new Map<string, ParsedDocument>();
	const symbolsById = new Map<string, ParsedSymbol>();
	const definitionsBySymbol = new Map<
		string,
		{ file: string; definition: SymbolDefinition }
	>();

	// Index documents by path
	for (const doc of scipData.documents) {
		documentsByPath.set(doc.relativePath, doc);

		// Index document symbols
		for (const sym of doc.symbols) {
			symbolsById.set(sym.symbol, sym);
		}

		// Index definitions
		const definitions = extractDefinitions(doc);
		for (const def of definitions) {
			definitionsBySymbol.set(def.symbol, {
				file: doc.relativePath,
				definition: def,
			});
		}
	}

	// Index external symbols
	for (const sym of scipData.externalSymbols) {
		symbolsById.set(sym.symbol, sym);
	}

	return {
		documentsByPath,
		symbolsById,
		definitionsBySymbol,
	};
}

/**
 * Get all symbols defined in a document
 */
export function getDocumentSymbols(
	doc: ParsedDocument,
	symbolsById: Map<string, ParsedSymbol>,
): Array<{
	symbol: string;
	name?: string;
	kind: number;
	range: [number, number, number, number];
	documentation?: string[];
}> {
	const definitions = extractDefinitions(doc);

	return definitions.map((def) => {
		const symbolInfo = symbolsById.get(def.symbol);
		return {
			symbol: def.symbol,
			name: symbolInfo?.displayName,
			kind: symbolInfo?.kind ?? 0,
			range: def.range,
			documentation: symbolInfo?.documentation,
		};
	});
}

/**
 * Get file dependencies for a document
 * Returns a map of file path -> set of symbols used from that file
 */
export function getFileDependencies(
	doc: ParsedDocument,
	documentsByPath: Map<string, ParsedDocument>,
	symbolsById: Map<string, ParsedSymbol>,
	definitionsBySymbol: Map<
		string,
		{ file: string; definition: SymbolDefinition }
	>,
): Map<string, Set<string>> {
	const references = extractReferences(doc);
	const depsByFile = new Map<string, Set<string>>();

	for (const ref of references) {
		// Skip if no symbol
		if (!ref.symbol) continue;

		// Find where this symbol is defined
		const defInfo = definitionsBySymbol.get(ref.symbol);
		if (!defInfo) continue;

		const defFile = defInfo.file;

		// Skip self-references (same file)
		if (defFile === doc.relativePath) continue;

		// Add to dependencies
		if (!depsByFile.has(defFile)) {
			depsByFile.set(defFile, new Set());
		}
		depsByFile.get(defFile)!.add(ref.symbol);
	}

	return depsByFile;
}
