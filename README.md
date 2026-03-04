# dora

A CLI that turns a SCIP index into a queryable SQLite database. Gives AI agents structured answers about your codebase instead of making them grep files and read imports.

## Why

When an AI agent needs to understand code, it typically reads files, searches for patterns, and traces imports manually. This is slow, burns tokens, and doesn't scale past a few hundred files.

dora pre-indexes your codebase into SQLite. Questions like "what depends on this file?", "where is this symbol used?", and "which files are most coupled?" become millisecond queries instead of multi-step explorations.

## Setup

### Install

Download the latest binary from the [releases page](https://github.com/butttons/dora/releases):

```bash
# macOS (ARM)
curl -L https://github.com/butttons/dora/releases/latest/download/dora-darwin-arm64 -o dora
chmod +x dora && sudo mv dora /usr/local/bin/

# macOS (Intel)
curl -L https://github.com/butttons/dora/releases/latest/download/dora-darwin-x64 -o dora
chmod +x dora && sudo mv dora /usr/local/bin/

# Linux
curl -L https://github.com/butttons/dora/releases/latest/download/dora-linux-x64 -o dora
chmod +x dora && sudo mv dora /usr/local/bin/
```

Or via npm (requires [Bun](https://bun.sh)):

```bash
bun install -g @butttons/dora
```

### Install a SCIP indexer

dora needs a SCIP index to work. Install one for your language:

```bash
# TypeScript / JavaScript
npm install -g @sourcegraph/scip-typescript
```

Other languages: [scip-java](https://github.com/sourcegraph/scip-java), [rust-analyzer](https://github.com/rust-lang/rust-analyzer), [scip-python](https://github.com/sourcegraph/scip-python), [scip-ruby](https://github.com/sourcegraph/scip-ruby), [scip-clang](https://github.com/sourcegraph/scip-clang), [scip-dotnet](https://github.com/sourcegraph/scip-dotnet), [scip-dart](https://github.com/Workiva/scip-dart).

### Initialize

```bash
cd your-project
dora init
dora index
```

`dora init` creates `.dora/config.json`. `dora index` runs the SCIP indexer and converts the output to SQLite.

## Usage

### Exploring a codebase

```bash
dora map                          # file count, symbol count, packages
dora ls src/                      # files in a directory with symbol/dep counts
dora status                       # index health and grammar availability
```

### Finding code

```bash
dora symbol AuthService           # find symbols by name
dora file src/auth/service.ts     # symbols, dependencies, dependents for a file
dora refs validateToken           # all references to a symbol across the codebase
```

### Understanding dependencies

```bash
dora deps src/auth/service.ts --depth 2    # what this file imports
dora rdeps src/auth/service.ts --depth 2   # what imports this file
dora adventure src/a.ts src/b.ts           # shortest path between two files
```

### Tree-sitter analysis (TypeScript / JavaScript)

These commands parse source directly without needing an index:

```bash
dora fn src/auth/service.ts       # functions with complexity, params, return type, LOC
dora class src/auth/service.ts    # classes with methods, implements, decorators
dora smells src/auth/service.ts   # high complexity, long functions, too many params, TODOs
```

Install a grammar to enable these:

```bash
bun add -g tree-sitter-typescript
```

### Architecture

```bash
dora cycles                        # bidirectional dependencies (A imports B, B imports A)
dora coupling --threshold 5        # file pairs with high symbol sharing
dora complexity --sort complexity  # files ranked by change risk
dora treasure                      # most imported files
dora lost                          # symbols with zero references
```

### Documentation

```bash
dora docs                          # list indexed markdown/text files
dora docs search "authentication"  # full-text search across docs
dora docs show docs/api.md         # which symbols and files a doc references
```

### Custom queries

```bash
dora schema                        # database schema
dora cookbook show quickstart      # walkthrough with real SQL examples
dora cookbook show methods         # query patterns for finding methods
dora query "SELECT path, symbol_count FROM files ORDER BY symbol_count DESC LIMIT 10"
```

### MCP server

```bash
dora mcp                           # start MCP server (stdio)

# Claude Code
claude mcp add --transport stdio dora -- dora mcp
```

### Output format

All commands output [TOON](https://github.com/toon-format/toon) by default — a compact JSON encoding optimized for LLM token usage. Pass `--json` for standard JSON.

```bash
dora status --json
```

## AI agent integration

For agent-specific setup (hooks, skills, AGENTS.md snippets) for Claude Code, OpenCode, Cursor, and Windsurf:

```bash
dora cookbook show agent-setup
```

Or see [AGENTS.README.md](./AGENTS.README.md).

## How it works

dora has two layers:

**SCIP layer** — runs your configured indexer (e.g. `scip-typescript`) to produce a `.scip` protobuf file, then parses it and loads it into SQLite. This gives you symbol definitions, references, and file-to-file dependencies derived from actual import resolution.

**Tree-sitter layer** — parses source files directly using WebAssembly grammars. This runs on-demand per file and extracts things SCIP doesn't cover: function signatures, cyclomatic complexity, class hierarchy details, and code smells.

The SQLite schema uses denormalized counts (`symbol_count`, `dependency_count`, `dependent_count`, `reference_count`) so most queries are index lookups rather than aggregations.

```
.dora/
├── config.json      # indexer command, ignore patterns, grammar paths
├── index.scip       # raw SCIP protobuf output
└── dora.db          # SQLite database (the thing dora actually queries)
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
