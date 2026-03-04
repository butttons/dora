# Contributing to dora

## Development setup

Requires [Bun](https://bun.sh) 1.0+.

```bash
git clone https://github.com/butttons/dora.git
cd dora
bun install
bun link          # makes `dora` point to src/index.ts via bun
```

Run any command directly:

```bash
bun src/index.ts status
bun src/index.ts symbol AuthService
```

## Testing

```bash
bun test ./test/              # full suite
bun test test/tree-sitter/    # tree-sitter tests only
bun run type-check            # tsc
bun run biome:format          # format src/ and test/
```

Tests use real fixture data from `test/fixtures/`. The tree-sitter tests are pure unit tests — they mock `Parser.QueryCapture[]` objects and run against the actual parse functions without loading any wasm grammar.

## Building

```bash
bun run build             # standalone binary for current platform → dist/dora
bun run build:npm         # bun-target JS bundle → dist/index.js (used by npm package)
bun run build:all         # all platform binaries (linux-x64, darwin-x64, darwin-arm64, windows-x64)
```

Binaries are ~57MB on macOS/Linux, ~58MB on Windows. They include the Bun runtime and have no external dependencies.

## Debug logging

```bash
DEBUG=dora:* dora index              # all namespaces
DEBUG=dora:converter dora index      # SCIP parsing and DB conversion
DEBUG=dora:index dora index          # index command only
DEBUG=dora:db dora symbol Foo        # database queries
```

Available namespaces: `dora:index`, `dora:converter`, `dora:db`, `dora:config`.

Example output:

```
$ DEBUG=dora:* dora index
  dora:index Loading configuration... +0ms
  dora:index Config loaded: root=/path/to/project +2ms
  dora:index Running SCIP indexer... +0ms
  dora:converter Parsing SCIP file... +28s
  dora:converter Parsed SCIP file: 412 documents +310ms
  dora:converter Converting 412 files to database... +0ms
  dora:converter Processing files: 412/412 (100%) +265ms
```

## Code conventions

- Single object parameter — never multiple positional params
- No inline comments, no section separators, no file headers
- No `any` — use `unknown` or proper types
- Boolean variables prefixed with `is` or `has`
- Use `type` not `interface`
- Output JSON to stdout, errors to stderr as `{"error": "message"}`, exit 1 on error

## Adding a command

1. Create `src/commands/mycommand.ts` and export a function
2. Register it in `src/index.ts`
3. Add MCP tool definition in `src/mcp/metadata.ts` and handler in `src/mcp/handlers.ts`
4. Add tests in `test/commands/`

## Adding a tree-sitter language

1. Create `src/tree-sitter/languages/mylang.ts` — export `functionQueryString`, `classQueryString`, `parseFunctionCaptures`, `parseClassCaptures`
2. Register it in `src/tree-sitter/languages/registry.ts` with its grammar name and file extensions
3. Add tests in `test/tree-sitter/mylang-captures.test.ts` — mock `Parser.QueryCapture[]` objects, test all capture variants, deduplication, and edge cases. See `test/tree-sitter/function-captures.test.ts` as the reference implementation.

The grammar wasm file is resolved automatically from local `node_modules`, global bun packages, or an explicit path in `.dora/config.json` under `treeSitter.grammars.<lang>`.

## Adding a query

1. Add the query function in `src/db/queries.ts`
2. Add tests in `test/db/queries.test.ts`
3. Use it in your command

## Modifying the database schema

1. Update `src/converter/schema.sql`
2. Update conversion logic in `src/converter/convert.ts`
3. Add migration logic if backward compatibility is required

## Architecture

```
src/
├── commands/       # one file per CLI command
├── converter/      # SCIP protobuf parser + SQLite converter
├── db/             # schema and all SQL queries
├── mcp/            # MCP server, tool definitions, handlers
├── schemas/        # Zod schemas and inferred types
├── tree-sitter/    # grammar discovery, parser, language implementations
└── utils/          # config, errors, output formatting
```

Key tables: `files`, `symbols`, `dependencies`, `symbol_references`, `packages`, `documents`, `metadata`.

Denormalized counts (`symbol_count`, `dependency_count`, `dependent_count`, `reference_count`) are updated after every index run and make most queries O(1) lookups.

For detailed schema and query patterns, see [CLAUDE.md](./CLAUDE.md).

## Troubleshooting

**Tests failing:** run `bun install` to sync deps, ensure `.dora/dora.db` exists (`dora index`).

**Build issues:** clear `dist/` and retry. Check `bun --version` is 1.0+.

**Local dev:** `bun link` points the `dora` binary at the source. `bun unlink` to restore.

## Pull request checklist

- `bun test ./test/` passes
- `bun run type-check` passes
- `bun run biome:format` applied
- New commands have tests
- New tree-sitter languages have capture tests
- [CLAUDE.md](./CLAUDE.md) updated if architecture changed
