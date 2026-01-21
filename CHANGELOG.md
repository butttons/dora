# @butttons/dora

## 1.4.1

### Patch Changes

- Fix UNIQUE constraint violation during batch processing when multiple SCIP documents reference same file path
- Add comprehensive test coverage for converter and batch processing edge cases

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
