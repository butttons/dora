## Code Exploration with dora

This codebase uses dora for fast code intelligence and architectural analysis.

### IMPORTANT: Use dora for code exploration

**ALWAYS use dora commands for code exploration instead of Grep/Glob/Find.**

### All Commands

**Overview:**

- `dora status` - Check index health, file/symbol counts, last indexed time
- `dora map` - Show packages, file count, symbol count

**Files & Symbols:**

- `dora ls [directory] [--limit N] [--sort field]` - List files in directory with metadata (symbols, deps, rdeps)
- `dora file <path>` - Show file's symbols, dependencies, and dependents
- `dora symbol <query> [--kind type] [--limit N]` - Find symbols by name across codebase
- `dora refs <symbol> [--kind type] [--limit N]` - Find all references to a symbol
- `dora exports <path>` - List exported symbols from a file
- `dora imports <path>` - Show what a file imports

**Dependencies:**

- `dora deps <path> [--depth N]` - Show file dependencies (what this imports)
- `dora rdeps <path> [--depth N]` - Show reverse dependencies (what imports this)
- `dora adventure <from> <to>` - Find shortest dependency path between two files

**Code Health:**

- `dora leaves [--max-dependents N]` - Find files with few/no dependents
- `dora lost [--limit N]` - Find unused exported symbols
- `dora treasure [--limit N]` - Find most referenced files and files with most dependencies

**Architecture Analysis:**

- `dora cycles [--limit N]` - Detect circular dependencies
- `dora coupling [--threshold N]` - Find bidirectionally dependent file pairs
- `dora complexity [--sort metric]` - Show file complexity metrics (sort by: complexity, symbols, stability)

**Change Impact:**

- `dora changes <ref>` - Show files changed since git ref and their impact
- `dora graph <path> [--depth N] [--direction type]` - Generate dependency graph

**Database:**

- `dora schema` - Show database schema (tables, columns, indexes)
- `dora query "<sql>"` - Execute read-only SQL query against the database

### When to Use Other Tools

- **Read**: For reading file source code
- **Grep**: Only for non-code files or when dora fails
- **Edit/Write**: For making changes
- **Bash**: For running commands/tests

### Quick Workflow

```bash
dora status                      # Check index health
dora treasure                    # Find core files
dora file <path>                 # Understand a file
dora deps/rdeps <path>           # Navigate dependencies
dora symbol <query>              # Find symbols
dora refs <symbol>               # Find references
```

For detailed usage and examples, refer to `./dora/docs/SKILL.md`.
