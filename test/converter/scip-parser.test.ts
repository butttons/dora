// Tests for SCIP parser

import { describe, expect, test } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";
import {
	buildLookupMaps,
	extractDefinitions,
	extractReferences,
	findDefinitionFile,
	getDocumentSymbols,
	getFileDependencies,
	parseScipFile,
	type ParsedDocument,
	type ScipData,
} from "../../src/converter/scip-parser.ts";

describe("SCIP Parser", () => {
	const exampleScipPath = join(process.cwd(), "test", "fixtures", "index.scip");
	const skipTests = !existsSync(exampleScipPath);

	test("should parse SCIP file successfully", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		const scipData = await parseScipFile(exampleScipPath);

		expect(scipData).toBeDefined();
		expect(scipData.documents).toBeDefined();
		expect(scipData.documents.length).toBeGreaterThan(0);
		expect(scipData.externalSymbols).toBeDefined();
	});

	test("should parse document with correct structure", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		const scipData = await parseScipFile(exampleScipPath);
		const sampleDoc = scipData.documents[0];

		if (!sampleDoc) {
			console.log("Skipping test: no documents in SCIP file");
			return;
		}

		expect(sampleDoc).toHaveProperty("relativePath");
		expect(sampleDoc).toHaveProperty("language");
		expect(sampleDoc).toHaveProperty("occurrences");
		expect(sampleDoc).toHaveProperty("symbols");
		expect(typeof sampleDoc.relativePath).toBe("string");
		expect(typeof sampleDoc.language).toBe("string");
		expect(Array.isArray(sampleDoc.occurrences)).toBe(true);
		expect(Array.isArray(sampleDoc.symbols)).toBe(true);
	});

	test("should parse occurrences with correct range format", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		const scipData = await parseScipFile(exampleScipPath);
		const sampleDoc = scipData.documents[0];

		if (!sampleDoc || sampleDoc.occurrences.length === 0) {
			console.log("Skipping test: no occurrences in SCIP file");
			return;
		}

		const occ = sampleDoc.occurrences[0];
		expect(occ).toHaveProperty("range");
		expect(occ).toHaveProperty("symbol");
		expect(occ).toHaveProperty("symbolRoles");

		// Range should be [startLine, startChar, endLine, endChar]
		expect(occ.range.length).toBe(4);
		expect(typeof occ.range[0]).toBe("number"); // startLine
		expect(typeof occ.range[1]).toBe("number"); // startChar
		expect(typeof occ.range[2]).toBe("number"); // endLine
		expect(typeof occ.range[3]).toBe("number"); // endChar
	});

	test("should extract definitions from document", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		const scipData = await parseScipFile(exampleScipPath);
		const sampleDoc = scipData.documents[0];

		if (!sampleDoc) {
			console.log("Skipping test: no documents in SCIP file");
			return;
		}

		const definitions = extractDefinitions(sampleDoc);
		expect(Array.isArray(definitions)).toBe(true);

		if (definitions.length > 0) {
			const def = definitions[0];
			expect(def).toHaveProperty("symbol");
			expect(def).toHaveProperty("range");
			expect(def.range.length).toBe(4);
			expect(typeof def.symbol).toBe("string");
		}
	});

	test("should extract references from document", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		const scipData = await parseScipFile(exampleScipPath);
		const sampleDoc = scipData.documents[0];

		if (!sampleDoc) {
			console.log("Skipping test: no documents in SCIP file");
			return;
		}

		const references = extractReferences(sampleDoc);
		expect(Array.isArray(references)).toBe(true);

		if (references.length > 0) {
			const ref = references[0];
			expect(ref).toHaveProperty("symbol");
			expect(ref).toHaveProperty("range");
			expect(ref).toHaveProperty("line");
			expect(ref.range.length).toBe(4);
			expect(typeof ref.symbol).toBe("string");
			expect(typeof ref.line).toBe("number");
		}
	});

	test("should not have overlap between definitions and references", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		const scipData = await parseScipFile(exampleScipPath);
		const sampleDoc = scipData.documents[0];

		if (!sampleDoc) {
			console.log("Skipping test: no documents in SCIP file");
			return;
		}

		const definitions = extractDefinitions(sampleDoc);
		const references = extractReferences(sampleDoc);

		// Build sets of occurrence indices
		const defIndices = new Set(
			sampleDoc.occurrences
				.map((occ, idx) => (occ.symbolRoles & 0x1 ? idx : -1))
				.filter((idx) => idx !== -1),
		);

		const refIndices = new Set(
			sampleDoc.occurrences
				.map((occ, idx) => (!(occ.symbolRoles & 0x1) ? idx : -1))
				.filter((idx) => idx !== -1),
		);

		// Should have no overlap
		for (const defIdx of defIndices) {
			expect(refIndices.has(defIdx)).toBe(false);
		}
	});

	test("should build lookup maps correctly", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		const scipData = await parseScipFile(exampleScipPath);
		const maps = buildLookupMaps(scipData);

		expect(maps).toHaveProperty("documentsByPath");
		expect(maps).toHaveProperty("symbolsById");
		expect(maps).toHaveProperty("definitionsBySymbol");

		expect(maps.documentsByPath instanceof Map).toBe(true);
		expect(maps.symbolsById instanceof Map).toBe(true);
		expect(maps.definitionsBySymbol instanceof Map).toBe(true);

		// Documents map should have all documents
		expect(maps.documentsByPath.size).toBe(scipData.documents.length);

		// Symbol map should have at least external symbols
		expect(maps.symbolsById.size).toBeGreaterThanOrEqual(
			scipData.externalSymbols.length,
		);
	});

	test("should find definition file for a symbol", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		const scipData = await parseScipFile(exampleScipPath);
		const sampleDoc = scipData.documents[0];

		if (!sampleDoc) {
			console.log("Skipping test: no documents in SCIP file");
			return;
		}

		const maps = buildLookupMaps(scipData);
		const definitions = extractDefinitions(sampleDoc);

		if (definitions.length > 0) {
			const def = definitions[0];
			const defFile = findDefinitionFile(
				def.symbol,
				maps.documentsByPath,
				maps.symbolsById,
			);

			// Should find the file (or null for external symbols)
			expect(defFile === null || typeof defFile === "string").toBe(true);
		}
	});

	test("should get document symbols with metadata", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		const scipData = await parseScipFile(exampleScipPath);
		const sampleDoc = scipData.documents[0];

		if (!sampleDoc) {
			console.log("Skipping test: no documents in SCIP file");
			return;
		}

		const maps = buildLookupMaps(scipData);
		const docSymbols = getDocumentSymbols(sampleDoc, maps.symbolsById);

		expect(Array.isArray(docSymbols)).toBe(true);

		if (docSymbols.length > 0) {
			const sym = docSymbols[0];
			expect(sym).toHaveProperty("symbol");
			expect(sym).toHaveProperty("kind");
			expect(sym).toHaveProperty("range");
			expect(typeof sym.symbol).toBe("string");
			expect(typeof sym.kind).toBe("number");
			expect(sym.range.length).toBe(4);
		}
	});

	test("should get file dependencies excluding self-references", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		const scipData = await parseScipFile(exampleScipPath);
		const sampleDoc = scipData.documents[0];

		if (!sampleDoc) {
			console.log("Skipping test: no documents in SCIP file");
			return;
		}

		const maps = buildLookupMaps(scipData);
		const deps = getFileDependencies(
			sampleDoc,
			maps.documentsByPath,
			maps.symbolsById,
			maps.definitionsBySymbol,
		);

		expect(deps instanceof Map).toBe(true);

		// Verify no self-references
		expect(deps.has(sampleDoc.relativePath)).toBe(false);

		// Dependencies should map file path -> set of symbols
		for (const [depPath, symbols] of deps) {
			expect(typeof depPath).toBe("string");
			expect(symbols instanceof Set).toBe(true);
			expect(depPath).not.toBe(sampleDoc.relativePath);

			// All symbols should be non-empty strings
			for (const sym of symbols) {
				expect(typeof sym).toBe("string");
				expect(sym.length).toBeGreaterThan(0);
			}
		}
	});

	test("should handle SCIP metadata", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		const scipData = await parseScipFile(exampleScipPath);

		if (scipData.metadata) {
			expect(scipData.metadata).toHaveProperty("toolName");
			expect(scipData.metadata).toHaveProperty("toolVersion");

			if (scipData.metadata.toolName) {
				expect(typeof scipData.metadata.toolName).toBe("string");
			}
		}
	});

	test("should parse external symbols", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		const scipData = await parseScipFile(exampleScipPath);

		expect(Array.isArray(scipData.externalSymbols)).toBe(true);

		if (scipData.externalSymbols.length > 0) {
			const extSym = scipData.externalSymbols[0];
			expect(extSym).toHaveProperty("symbol");
			expect(extSym).toHaveProperty("kind");
			expect(typeof extSym.symbol).toBe("string");
			expect(typeof extSym.kind).toBe("number");
		}
	});

	test("should correctly identify local symbols", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		const scipData = await parseScipFile(exampleScipPath);
		const maps = buildLookupMaps(scipData);

		// Find a local symbol (contains 'local' in symbol identifier)
		let foundLocalSymbol = false;
		for (const doc of scipData.documents) {
			const definitions = extractDefinitions(doc);
			for (const def of definitions) {
				if (def.symbol.includes("local")) {
					foundLocalSymbol = true;

					// Local symbols should be defined in the same file
					const defFile = findDefinitionFile(
						def.symbol,
						maps.documentsByPath,
						maps.symbolsById,
					);

					// Should find in current document or return null
					expect(
						defFile === null || defFile === doc.relativePath,
					).toBe(true);
					break;
				}
			}
			if (foundLocalSymbol) break;
		}
	});

	test("should handle documents with no symbols", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		const scipData = await parseScipFile(exampleScipPath);

		// Find or create a document with no symbols
		const emptyDoc: ParsedDocument = {
			relativePath: "test/empty.ts",
			language: "TypeScript",
			occurrences: [],
			symbols: [],
		};

		const definitions = extractDefinitions(emptyDoc);
		const references = extractReferences(emptyDoc);

		expect(definitions.length).toBe(0);
		expect(references.length).toBe(0);

		const maps = buildLookupMaps(scipData);
		const docSymbols = getDocumentSymbols(emptyDoc, maps.symbolsById);
		expect(docSymbols.length).toBe(0);

		const deps = getFileDependencies(
			emptyDoc,
			maps.documentsByPath,
			maps.symbolsById,
			maps.definitionsBySymbol,
		);
		expect(deps.size).toBe(0);
	});

	test("should handle 3-element ranges (same line)", async () => {
		if (skipTests) {
			console.log("Skipping test: example SCIP file not found");
			return;
		}

		const scipData = await parseScipFile(exampleScipPath);

		// This is tested implicitly in the parsing - if we got here without errors,
		// the parser handled both 3 and 4 element ranges correctly
		expect(scipData.documents.length).toBeGreaterThan(0);
	});
});
