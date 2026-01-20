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
	document_count?: number;
	documents_by_type?: Array<{ type: string; count: number }>;
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

export interface EntryPoint {
	path: string;
	type: "main" | "bin" | "lib" | "export" | "worker";
	name?: string;
	description?: string;
	language: string;
}

export interface EntryPointsResult {
	detected_from: "config" | "pattern";
	config_file?: string;
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

export interface Document {
	path: string;
	type: string;
}

export interface GlobalSymbol {
	name: string;
	kind: string;
	path: string;
	start_line: number;
}

export interface DocumentSymbolRef extends GlobalSymbol {
	lines: number[];
}

export interface DocumentFileRef {
	path: string;
	lines: number[];
}

export interface DocumentDocRef {
	path: string;
	lines: number[];
}

export interface DocumentReferences {
	symbols: DocumentSymbolRef[];
	files: DocumentFileRef[];
	documents: DocumentDocRef[];
}

export interface DocResult {
	path: string;
	type: string;
	symbol_refs: DocumentSymbolRef[];
	file_refs: DocumentFileRef[];
	document_refs: DocumentDocRef[];
	content?: string;
}

export interface DefnEnclosingRange {
	path: string;
	start_line: number;
	end_line: number;
}
