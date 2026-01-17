---
name: ctx
description: Query codebase using dora CLI for code intelligence, symbol definitions, dependencies, and architectural analysis
---

## Philosophy

Use dora FIRST for code exploration. It understands structure, dependencies, and relationships. Use Grep/Read only for reading source code or when dora doesn't have what you need.

## Commands

### Overview

**`dorastatus`** - Check index health, file/symbol counts, last indexed time

**`doraoverview`** - Show packages, file count, symbol count

### Files & Symbols

**`dorafile <path>`** - Show file's symbols, dependencies, and dependents. Note: includes local symbols (parameters).

**`dorasymbol <query> [--kind type] [--limit N]`** - Find symbols by name across codebase

**`dorarefs <symbol> [--kind type] [--limit N]`** - Find all references to a symbol

**`doraexports <path>`** - List exported symbols from a file. Note: includes function parameters.

**`doraimports <path>`** - Show what a file imports

### Dependencies

**`doradeps <path> [--depth N]`** - Show file dependencies (what this imports). Default depth: 1

**`dorardeps <path> [--depth N]`** - Show reverse dependencies (what imports this). Default depth: 1

**`dorapath <from> <to>`** - Find shortest dependency path between two files

### Code Health

**`doraleaves [--max-dependents N]`** - Find files with few/no dependents. Default: 0

**`doraunused [--limit N]`** - Find unused exported symbols. Default limit: 50

**`dorahotspots [--limit N]`** - Find most referenced files and files with most dependencies. Default: 10

### Architecture Analysis

**`doracycles [--limit N]`** - Detect circular dependencies. Empty = good. Default: 50

**`doracoupling [--threshold N]`** - Find bidirectionally dependent file pairs. Default threshold: 5

**`doracomplexity [--sort metric]`** - Show file complexity (symbol_count, outgoing_deps, incoming_deps, stability_ratio, complexity_score). Sort by: complexity, symbols, stability. Default: complexity

### Change Impact

**`dorachanges <ref>`** - Show files changed since git ref and their impact

**`doragraph <path> [--depth N] [--direction type]`** - Generate dependency graph. Direction: deps, rdeps, both. Default: both, depth 1

### Database

**`doraschema`** - Show database schema (tables, columns, indexes)

**`doraquery "<sql>"`** - Execute read-only SQL query against the database

## When to Use What

- Finding symbols → `dorasymbol`
- Understanding a file → `dorafile`
- Impact of changes → `dorardeps`, `dorarefs`
- Finding entry points → `dorahotspots`, `doraleaves`
- Architecture issues → `doracycles`, `doracoupling`, `doracomplexity`
- Navigation → `doradeps`, `dorapath`
- Dead code → `doraunused`
- Custom queries → `doraschema` then `doraquery`

## Typical Workflow

1. `dorastatus` - Check index health
2. `dorahotspots` - Find core files
3. `dorafile <path>` - Understand specific files
4. `doradeps`/`dorardeps` - Navigate relationships
5. `dorarefs` - Check usage before changes

## Limitations

- Includes local symbols (parameters) in `dorafile` and `doraexports`
- Symbol search is substring-based, not fuzzy
- Index is a snapshot, updates at checkpoints
