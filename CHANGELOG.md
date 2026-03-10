# @butttons/dora

## 2.0.0

### New Commands

- `dora fn <path>` — list all functions in a file with cyclomatic complexity, LOC, parameter types, return type, async/export flags, and SCIP reference count. Sort by complexity, loc, or name. Filter by minimum complexity.
- `dora class <path>` — list all classes with inheritance, implemented interfaces, decorators, abstract flag, method list, and property count. Sort by name, method count, or total complexity.
- `dora smells <path>` — detect code smells: high cyclomatic complexity, long functions, too many parameters, god classes (too many methods), large classes (too many properties), and TODO/FIXME/HACK comments. All thresholds configurable.

### Enhancements

- `dora file` now includes per-file metrics (LOC, SLOC, comment lines, blank lines, function count, avg/max complexity) and a full function list when a tree-sitter grammar is available.
- `dora symbol` now enriches function and method results with cyclomatic complexity, parameter types, and return type from tree-sitter.
- `dora status` now reports grammar availability for every registered language instead of only the project's primary language.

### Tree-sitter Integration

- Grammar discovery checks project-local `node_modules`, global bun packages, and explicit paths in `.dora/config.json` under `treeSitter.grammars`.
- TypeScript, TSX, JavaScript, and JSX supported out of the box. Additional languages can be added by implementing a query module and registering it.
- Parser WASM is initialized once per process. Language grammars are cached after first load. Global node_modules path is resolved once and cached.
- A tree-sitter cookbook recipe (`dora cookbook show tree-sitter`) covers workflows, complexity thresholds, and pre-refactor checklists.

### Bug Fixes

- Nullish coalescing (`??`) was not counted in cyclomatic complexity. The operator is a `binary_expression` node in tree-sitter, not a standalone node type.
- `bun.lock` (text format, Bun 1.1+) was not recognized by workspace detection. Only `bun.lockb` was checked, causing wrong `scip-typescript` flags for newer Bun projects.
- TODO comment scanning in `dora smells` missed markers inside multi-line block comments.
- `dora fn` and `dora class` silently fell back to the default sort on unrecognized `--sort` values instead of throwing an error.
- Absolute paths in tree-sitter commands were built with string interpolation instead of `path.resolve`, which is fragile on Windows and with trailing slashes.

## 1.7.0

### Minor Changes

- Default output format is now TOON (Token-Oriented Object Notation) for reduced token usage
- Add global `--json` flag to all commands for JSON output
- Add npm publishing to release workflow

### Patch Changes

- Fix agents readme file link in docs website

## 1.6.1

### Patch Changes

- Add `agent-setup` cookbook recipe with setup instructions for Claude Code, pi, OpenCode, Cursor, Windsurf, and MCP
- Add pi integration guide to AGENTS documentation with project-local extensions and plan mode support
- Rename AGENTS.md to AGENTS.README.md for clarity
- Update docs site with pi references and agent-setup cookbook tips
- Add missing languages as valid options for `dora init`

## 1.6.0

### Minor Changes

- Add MCP (Model Context Protocol) server via `dora mcp` command
- All 29 dora commands available as MCP tools for AI assistants
- Simple setup for Claude Code: `claude mcp add --transport stdio dora -- dora mcp`
- Add Zod schema validation for all command results
- Refactor type system with dedicated `src/schemas/` directory

### Patch Changes

- Fix TypeScript strict mode errors across codebase
- Add type checking to CI workflow
- Standardize command output patterns for better consistency

## 1.5.0

### Patch Changes

- Fix TypeScript strict errors.

## 1.4.6

### Patch Changes

- Fix indexer crash: update convertToDatabase call to use object parameters instead of positional arguments
- Fix database lock error during full rebuild by closing existing connections and removing database file before reindexing

## 1.4.5

### Patch Changes

- Add `--language` flag to `dora init` for explicit language specification (typescript, javascript, python, rust, go, java)
- Optimize document processing performance and fix `--ignore` flag handling
- Refactor multi-parameter functions to use object parameters for better readability and maintainability

## 1.4.4

### Patch Changes

- Fix package manager detection to check for bun, pnpm, and yarn lock files before defaulting to npm
- Fix Rust indexing command to include required path argument. Thanks @dkmnx! (#4, fixes #3)
- Fix cookbook command syntax in documentation
- Add installation instructions to llm.txt documentation

## 1.4.3

### Patch Changes

- Fix template files not found when using `dora init`

## 1.4.2

### Patch Changes

- Update all documentation to use new cookbook subcommand syntax (`dora cookbook show`)

## 1.4.1

### Patch Changes

- Add `--ignore <pattern>` flag to `dora index` for excluding files via glob patterns (can be repeated)
- Add optional `ignore` field in `.dora/config.json` for persistent ignore patterns
- Document custom cookbook feature: users can add recipes in `.dora/cookbooks/` directory
- Fix UNIQUE constraint violation during batch processing when multiple SCIP documents reference same file path
- Add test coverage for converter and batch processing edge cases

## 1.4.0

### Minor Changes

- Refactor `dora cookbook` to use subcommands for better UX:
  - `dora cookbook list` - List all available recipes
  - `dora cookbook show [recipe]` - Show a specific recipe or index
  - Add `--format` flag supporting `json` (default) and `markdown` output
- Cookbook files now read from `.dora/cookbook/` for customization
- Cookbook templates automatically copied during `dora init`

## 1.3.1

### Patch Changes

- Add comprehensive cookbook system with 4 thoroughly tested recipes:
  - **quickstart** - Complete walkthrough exploring a codebase from scratch
  - **methods** - Finding class methods with 5 SQL patterns
  - **references** - Tracking symbol usage with 6 SQL patterns
  - **exports** - Finding exported symbols vs internal symbols
- All cookbook recipes now include real examples tested on dora's own codebase

## 1.3.0

### Minor Changes

- **BREAKING**: Remove `dora docs find` command (redundant with `documented_in` field in symbol/file commands)
- Add `dora docs` list command to show all documentation files
- Add `--type` flag to filter docs by md/txt
- Improve `dora symbol` and `dora file` to show `documented_in` field
- Fix `dora docs show` to filter out empty symbol names

## 1.2.2

### Patch Changes

- Simplified documentation indexing to support only Markdown (.md) and plain text (.txt) files

## 1.2.1

### Patch Changes

- Update formatting and documentation

## 1.2.0

### Minor Changes

- Added document-to-document references.

## 1.1.0

### Minor Changes

- Add documentation indexing and search capabilities
- New `dora docs` commands: find, search, show
- Index documentation files (.md, .txt) with symbol and file reference tracking
- Integrate documentation stats into `dora status`, `dora symbol`, and `dora file` commands
- Add file scanner with .gitignore support for document processing
- Support incremental document processing for faster reindexing

## 1.0.0

### Major Changes

- Initial release of dora CLI
- Core commands: init, index, status, map, file, symbol, deps, rdeps
- SCIP protobuf parsing with optimized SQLite storage
- Architecture analysis commands: cycles, coupling, complexity
- Symbol search and reference tracking
