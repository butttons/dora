# CLAUDE.md

dora is a CLI that converts SCIP indexes into a queryable SQLite database. AI agents use it to answer questions about large codebases without reading files or tracing imports manually.

## Stack

- Runtime: Bun
- Database: SQLite via `bun:sqlite`
- Language: TypeScript
- Protobuf parsing: `@bufbuild/protobuf`
- AST parsing: `web-tree-sitter` (on-demand, per file)
- Output format: TOON by default (`dora status`), JSON via `--json` (`dora status --json`)

## Source layout

```
src/
├── commands/       # one file per CLI command
├── converter/      # SCIP protobuf parser + SQLite converter
├── db/             # schema and all SQL queries
├── mcp/            # MCP server, tool definitions, handlers
├── schemas/        # Zod schemas and inferred types
├── tree-sitter/    # grammar discovery, parser, language registry
└── utils/          # config, errors, output formatting
```

## Two indexing layers

**SCIP** — runs the configured indexer (e.g. `scip-typescript`), produces a `.scip` protobuf, converts it to SQLite. Gives you symbols, references, and file-to-file dependencies derived from actual import resolution.

**Tree-sitter** — parses source files on-demand using wasm grammars. Covers what SCIP doesn't: function signatures, cyclomatic complexity, class hierarchy, code smells. Grammar discovery checks local `node_modules`, then global bun packages, then explicit config paths.

## Database design

Denormalized counts (`symbol_count`, `dependency_count`, `dependent_count`, `reference_count`) are pre-computed at index time. Most queries are index lookups, not aggregations.

Local symbols (function parameters, closure variables) are flagged `is_local = 1` and filtered out by default. Symbol kinds are extracted from SCIP documentation strings since `scip-typescript` doesn't populate the kind field.

Schema: `src/converter/schema.sql`. All queries: `src/db/queries.ts`.

## Config file: `.dora/config.json`

```json
{
  "root": "/absolute/path/to/repo",
  "scip": ".dora/index.scip",
  "db": ".dora/dora.db",
  "commands": {
    "index": "scip-typescript index --output .dora/index.scip"
  },
  "lastIndexed": "2025-01-15T10:30:00Z",
  "ignore": ["test/**", "**/*.generated.ts"],
  "treeSitter": {
    "grammars": {
      "typescript": "/explicit/path/to/tree-sitter-typescript.wasm"
    }
  }
}
```

## Code conventions

- Single object parameter — never multiple positional params
- No inline comments, no section separators, no file headers
- No `any` — use `unknown` or proper types
- Boolean variables prefixed with `is` or `has`
- Use `type` not `interface`
- No emojis
- Output JSON to stdout, errors to stderr as `{"error": "message"}`, exit 1 on error

## Adding a tree-sitter language

1. Create `src/tree-sitter/languages/mylang.ts` — export `functionQueryString`, `classQueryString`, `parseFunctionCaptures`, `parseClassCaptures`
2. Register in `src/tree-sitter/languages/registry.ts` with grammar name and extensions
3. Add tests in `test/tree-sitter/` — see `function-captures.test.ts` as the reference. Tests mock `Parser.QueryCapture[]` objects directly; no wasm or disk I/O needed.

## Hooks (`.claude/settings.json`)

- **Stop**: runs `dora index` in the background after each turn
- **SessionStart**: checks index health, prompts to init if missing
