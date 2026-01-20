# @butttons/dora

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
- Index documentation files (.md, .json, .yaml, .toml) with symbol and file reference tracking
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
