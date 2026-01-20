# @butttons/dora

## 1.3.0

### Minor Changes

- Fix `dora docs show` to filter out empty symbol names
- Fix `dora docs find` symbol lookup to work without exact line number match
- Improve fallback behavior in `dora docs find` to try fuzzy search when exact match has no docs

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
