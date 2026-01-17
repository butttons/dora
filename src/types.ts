// Type definitions for ctx CLI
// Note: Config and IndexState types are now defined in src/utils/config.ts using Zod

// Command result types

export interface InitResult {
	success: boolean;
	root: string;
	message: string;
}

export interface StatusResult {
	initialized: boolean;
	indexed: boolean;
	file_count?: number;
	symbol_count?: number;
	last_indexed?: string | null;
}

export interface OverviewResult {
	packages: string[];
	file_count: number;
	symbol_count: number;
}

export interface LeavesResult {
	max_dependents: number;
	leaves: string[];
}

// Entry point detection types

export interface EntryPoint {
	path: string; // File path relative to repo root
	type: "main" | "bin" | "lib" | "export" | "worker";
	name?: string; // CLI command name for bin entries
	description?: string; // From config (e.g., bin description)
	language: string; // typescript, python, rust, go, java
}

export interface EntryPointsResult {
	detected_from: "config" | "pattern"; // How we found them
	config_file?: string; // Which config file we read
	entries: EntryPoint[];
}

export interface FileSymbol {
	name: string;
	kind: string;
	lines: [number, number];
}

export interface FileDependency {
	path: string;
	symbols?: string[];
}

export interface FileDependent {
	path: string;
	refs: number;
}

export interface FileResult {
	path: string;
	symbols: FileSymbol[];
	depends_on: FileDependency[];
	depended_by: FileDependent[];
}

export interface SymbolResult {
	name: string;
	kind: string;
	path: string;
	lines?: [number, number];
}

export interface SymbolSearchResult {
	query: string;
	results: SymbolResult[];
}

export interface RefsResult {
	symbol: string;
	kind: string;
	definition: {
		path: string;
		line: number;
	};
	references: string[];
	total_references: number;
}

export interface RefsSearchResult {
	query: string;
	results: RefsResult[];
}

export interface DependencyNode {
	path: string;
	depth: number;
}

export interface DepsResult {
	path: string;
	depth: number;
	dependencies: DependencyNode[];
}

export interface RDepsResult {
	path: string;
	depth: number;
	dependents: DependencyNode[];
}

export interface PathResult {
	from: string;
	to: string;
	path: string[];
	distance: number;
}

export interface IndexResult {
	success: boolean;
	file_count: number;
	symbol_count: number;
	time_ms: number;
	mode?: "full" | "incremental" | "cached";
	changed_files?: number;
}

export interface ReindexDecision {
	shouldReindex: boolean;
	reason: string;
	changedFiles?: string[];
}

export interface ErrorResult {
	error: string;
}

// New command result types

export interface ExportedSymbol {
	name: string;
	kind: string;
	file?: string;
	lines: [number, number];
}

export interface ExportsResult {
	target: string;
	exports: ExportedSymbol[];
}

export interface ImportedFile {
	file: string;
	symbols: string[];
}

export interface ImportsResult {
	path: string;
	imports: ImportedFile[];
}

export interface UnusedSymbol {
	name: string;
	file: string;
	lines: [number, number];
	kind: string;
}

export interface UnusedResult {
	unused: UnusedSymbol[];
}

export interface Hotspot {
	file: string;
	count: number;
}

export interface HotspotsResult {
	most_referenced: Hotspot[];
	most_dependencies: Hotspot[];
}

export interface ChangesResult {
	ref: string;
	changed: string[];
	impacted: string[];
	total_impacted: number;
}

export interface PackageResult {
	name: string;
	files: string[];
	exports: ExportedSymbol[];
	depends_on: string[];
	depended_by: string[];
}

export interface TestsResult {
	file: string;
	tests: string[];
}

export interface GraphEdge {
	from: string;
	to: string;
}

export interface GraphResult {
	root: string;
	direction: string;
	depth: number;
	nodes: string[];
	edges: GraphEdge[];
}

export interface Cycle {
	files: string[];
	length: number;
}

export interface CyclesResult {
	cycles: Cycle[];
}

export interface CoupledFiles {
	file1: string;
	file2: string;
	symbols_1_to_2: number;
	symbols_2_to_1: number;
	total_coupling: number;
}

export interface CouplingResult {
	threshold: number;
	coupled_files: CoupledFiles[];
}

export interface ComplexityMetric {
	path: string;
	symbol_count: number;
	outgoing_deps: number;
	incoming_deps: number;
	stability_ratio: number;
	complexity_score: number;
}

export interface ComplexityResult {
	sort_by: string;
	files: ComplexityMetric[];
}

// Symbol kind conversion is handled in converter/helpers.ts
// which has the correct SCIP protobuf symbol kind mappings
