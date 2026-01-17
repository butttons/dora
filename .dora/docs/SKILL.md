---
name: dora-cli
description: Query codebase using dora  CLI for code intelligence, symbol definitions, dependencies, and architectural analysis
---

## Philosophy

Use dora FIRST for code exploration. It understands structure, dependencies, and relationships. Use Grep/Read only for reading source code or when dora doesn't have what you need.

## Commands

### Overview

**`dora status`** - Check index health, file/symbol counts, last indexed time

**`dora map`** - Show packages, file count, symbol count

### Files & Symbols

**`dora ls [directory] [--limit N] [--sort field]`** - List files in directory with metadata (symbols, deps, rdeps). Default limit: 100

**`dora file <path>`** - Show file's symbols, dependencies, and dependents. Note: includes local symbols (parameters).

**`dora symbol <query> [--kind type] [--limit N]`** - Find symbols by name across codebase

**`dora refs <symbol> [--kind type] [--limit N]`** - Find all references to a symbol

**`dora exports <path>`** - List exported symbols from a file. Note: includes function parameters.

**`dora imports <path>`** - Show what a file imports

### Dependencies

**`dora deps <path> [--depth N]`** - Show file dependencies (what this imports). Default depth: 1

**`dora rdeps <path> [--depth N]`** - Show reverse dependencies (what imports this). Default depth: 1

**`dora adventure <from> <to>`** - Find shortest dependency path between two files

### Code Health

**`dora leaves [--max-dependents N]`** - Find files with few/no dependents. Default: 0

**`dora lost [--limit N]`** - Find unused exported symbols. Default limit: 50

**`dora treasure [--limit N]`** - Find most referenced files and files with most dependencies. Default: 10

### Architecture Analysis

**`dora cycles [--limit N]`** - Detect circular dependencies. Empty = good. Default: 50

**`dora coupling [--threshold N]`** - Find bidirectionally dependent file pairs. Default threshold: 5

**`dora complexity [--sort metric]`** - Show file complexity (symbol_count, outgoing_deps, incoming_deps, stability_ratio, complexity_score). Sort by: complexity, symbols, stability. Default: complexity

### Change Impact

**`dora changes <ref>`** - Show files changed since git ref and their impact

**`dora graph <path> [--depth N] [--direction type]`** - Generate dependency graph. Direction: deps, rdeps, both. Default: both, depth 1

### Database

**`dora schema`** - Show database schema (tables, columns, indexes)

**`dora query "<sql>"`** - Execute read-only SQL query against the database

## When to Use What

- Finding symbols → `dora symbol`
- Understanding a file → `dora file`
- Impact of changes → `dora rdeps`, `dora refs`
- Finding entry points → `dora treasure`, `dora leaves`
- Architecture issues → `dora cycles`, `dora coupling`, `dora complexity`
- Navigation → `dora deps`, `dora adventure`
- Dead code → `dora lost`
- Custom queries → `dora schema` then `dora query`

## Typical Workflow

1. `dora status` - Check index health
2. `dora treasure` - Find core files
3. `dora file <path>` - Understand specific files
4. `dora deps`/`dora rdeps` - Navigate relationships
5. `dora refs` - Check usage before changes

## Limitations

- Includes local symbols (parameters) in `dora file` and `dora exports`
- Symbol search is substring-based, not fuzzy
- Index is a snapshot, updates at checkpoints
