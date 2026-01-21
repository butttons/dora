# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

# Build: dora - Code Context CLI for AI Agents

## Overview

Build a CLI tool called `dora` using Bun and SQLite. It helps AI agents understand large codebases by parsing SCIP protobuf indexes directly.

## Tech Stack

- Runtime: Bun
- Database: SQLite (via bun:sqlite)
- Language: TypeScript
- Protobuf: @bufbuild/protobuf
- Indexer: scip-typescript (external dependency)

## Documentation Website

The `docs/` directory contains the documentation website for dora, built with Astro and deployed to https://dora-cli.dev.

- **Tech Stack:** Astro 5.x, Tailwind CSS 4.x, Cloudflare Workers
- **Pages:** Landing page (with platform/language detection), full documentation, command reference, architecture guide
- **Features:** Dynamic installation instructions for 9+ languages, AI agent integration examples, responsive design
- **Deployment:** Cloudflare Workers via wrangler (`bun run deploy` in docs directory)

See `docs/CLAUDE.md` for detailed documentation-specific guidance on maintaining and updating the website.

## Code Style Guidelines

### Comments

This codebase follows strict comment guidelines to maintain clean, self-documenting code:

**Rules:**

1. **NO inline comments** - Code should be self-explanatory through clear function and variable names
2. **NO section separator comments** - Like `// ===== Section Name =====` or `// Query commands`
3. **NO file header comments** - Like `// dora symbol command` or `// Type definitions for dora CLI`
4. **Use ONLY valid JSDoc** - And only when clearly warranted for complex public APIs
5. **NO emojis** - Keep code and comments professional and emoji-free

**Valid JSDoc Format:**

```typescript
/**
 * Find shortest path between two files using BFS
 */
export function findPath(from: string, to: string): string[] {
  // Implementation
}
```

**Examples of Comments to AVOID:**

```typescript
// BAD - Obvious inline comment
const limit = options.limit || 20;  // Default limit is 20

// BAD - Section separator
// ===== Status Queries =====

// BAD - File header
// dora symbol command

// BAD - Explaining obvious code
// Get the symbol ID
const symbolId = getSymbolId(name);

// BAD - Trivial explanation
// Loop through results
for (const result of results) {
  // Process each result
  processResult(result);
}
```

**Examples of Comments to KEEP:**

```typescript
/**
 * GOOD - Valid JSDoc for complex function
 * Find tightly coupled file pairs (bidirectional dependencies)
 */
export function getCoupledFiles(threshold: number): CoupledFiles[] {
  // Implementation
}

/**
 * GOOD - JSDoc with parameters and return type
 * @param db - Database connection
 * @param path - File path to analyze
 * @returns Array of dependency nodes with depth information
 */
export function getDependencies(db: Database, path: string): DependencyNode[] {
  // Implementation
}
```

**When Comments ARE Warranted:**

- Complex algorithms that aren't immediately obvious
- Non-obvious edge cases or workarounds
- Security-related warnings or considerations
- Performance optimizations that aren't self-evident

**Note:** Generated files (like `scip_pb.ts`) are exempt from these rules.

## Directory Structure

Note: Example scip files in `example` folder
Required tools:

```
scip-typescript  # For generating SCIP indexes
```

```
dora/
├── src/
│   ├── index.ts              # CLI entry point (Commander)
│   ├── commands/
│   │   ├── init.ts           # Initialize dora
│   │   ├── index.ts          # Reindex command
│   │   ├── status.ts         # Show index status
│   │   ├── overview.ts       # High-level statistics
│   │   ├── file.ts           # File analysis
│   │   ├── symbol.ts         # Symbol search
│   │   ├── deps.ts           # Dependencies
│   │   ├── rdeps.ts          # Reverse dependencies
│   │   ├── path.ts           # Find path between files
│   │   ├── changes.ts        # Changed/impacted files
│   │   ├── exports.ts        # Exported symbols
│   │   ├── imports.ts        # File imports
│   │   ├── leaves.ts         # Leaf nodes
│   │   ├── refs.ts           # Symbol references
│   │   ├── unused.ts         # Unused symbols
│   │   ├── hotspots.ts       # Most referenced files
│   │   ├── graph.ts          # Dependency graph
│   │   ├── ls.ts             # List files in directory
│   │   └── shared.ts         # Shared utilities
│   ├── converter/
│   │   ├── convert.ts        # SCIP → SQLite converter
│   │   ├── scip-parser.ts    # SCIP protobuf parser
│   │   ├── scip_pb.ts        # Generated protobuf types
│   │   ├── helpers.ts        # Symbol kind mappings
│   │   └── schema.sql        # Database schema
│   ├── proto/
│   │   └── scip.proto        # SCIP protobuf schema
│   ├── db/
│   │   ├── queries.ts        # All SQL queries
│   │   └── connection.ts     # Database setup
│   └── utils/
│       ├── config.ts         # Config read/write
│       ├── output.ts         # JSON formatting
│       ├── errors.ts         # Error handling
│       └── changeDetection.ts # Incremental indexing
├── package.json
└── tsconfig.json
```

## Config File: .dora/config.json

```json
{
  "root": "/absolute/path/to/repo",
  "scip": ".dora/index.scip",
  "db": ".dora/dora.db",
  "commands": {
    "index": "scip-typescript index --output .dora/index.scip"
  },
  "lastIndexed": "2025-01-15T10:30:00Z",
  "ignore": ["test/**", "**/*.generated.ts"]
}
```

**Optional fields:**
- `ignore` - Array of glob patterns for files to exclude from indexing (e.g., `["test/**", "**/*.d.ts"]`)

## Hooks

This project uses two Claude Code hooks configured in `.claude/settings.json`:

### Stop hook

Automatically runs `dora index` in the background after each AI turn to keep the index up-to-date. Logs output to `/tmp/dora-index.log`. Non-blocking and never fails.

Command: `(dora index > /tmp/dora-index.log 2>&1 &) || true`

### SessionStart hook

Checks if dora is initialized when a new session starts. If not initialized, displays a hint to run `dora init && dora index`.

Command: `dora status 2>/dev/null || echo 'dora not initialized. Run: dora init && dora index'`

## Database Schema

The doraCLI uses an optimized SQLite database with denormalized fields for high performance:

### files

- `id` - Primary key
- `path` - Relative path from repo root (UNIQUE)
- `language` - Programming language
- `mtime` - File modification time
- `symbol_count` - Number of symbols in file (denormalized)
- `indexed_at` - When file was indexed
- `dependency_count` - Number of outgoing dependencies (denormalized)
- `dependent_count` - Number of incoming dependencies / fan-in (denormalized)

### symbols

- `id` - Primary key
- `file_id` - Foreign key to files table
- `name` - Symbol name (e.g., "Logger", "UserContext")
- `scip_symbol` - Full SCIP symbol identifier
- `kind` - Symbol kind extracted from documentation (class, function, interface, property, method, parameter, variable, type, enum, etc.)
- `start_line`, `end_line` - Line range
- `start_char`, `end_char` - Character range
- `documentation` - Symbol documentation/comments
- `package` - Package name if external symbol
- `is_local` - Boolean flag for local symbols (function parameters, closure variables) - filtered by default
- `reference_count` - Number of references to this symbol (denormalized)

### dependencies

- `from_file_id` - File that imports
- `to_file_id` - File being imported
- `symbol_count` - Number of symbols used
- `symbols` - JSON array of symbol names used

### symbol_references

- `id` - Primary key
- `symbol_id` - Foreign key to symbols table
- `file_id` - File where symbol is referenced
- `line` - Line number of reference

### packages

- `id` - Primary key
- `name` - Package name (e.g., "@org/package")
- `manager` - Package manager (npm, yarn, etc.)
- `version` - Package version
- `symbol_count` - Number of symbols from this package

### metadata

- `key` - Metadata key
- `value` - Metadata value

## Commands

### dora init

- Detect repo root (find nearest package.json or tsconfig.json)
- Create .dora/ directory
- Add .dora to .gitignore if not present
- Write initial config.json
- Output: success message

Note: Hooks are configured in .claude/settings.json (Stop and SessionStart)

### dora index

- Run: `scip-typescript index --output .dora/index.scip` (if configured)
- Parse SCIP protobuf file directly using @bufbuild/protobuf
- Convert to optimized custom SQLite database
- Support incremental builds (only reindex changed files)
- Update lastIndexed in config
- **Flags:**
  - `--full` - Force full rebuild (ignore incremental detection)
  - `--skip-scip` - Skip running SCIP indexer, use existing .scip file
  - `--ignore <pattern>` - Ignore files matching glob pattern (can be repeated)
- Output: file count, symbol count, time taken, mode (full/incremental)

### dora status

- Check if .dora/dora.db exists
- Query file count, symbol count
- Show lastIndexed timestamp
- Output: JSON with health info

### dora map

Provides high-level statistics about the codebase: packages, file count, and symbol count.

Queries:

```sql
-- Packages
SELECT name
FROM packages
ORDER BY name;

-- File count
SELECT COUNT(*) as count FROM files;

-- Symbol count
SELECT COUNT(*) as count FROM symbols;
```

Output:

```json
{
  "packages": ["@zomunk/api-worker", ...],
  "file_count": 412,
  "symbol_count": 58917
}
```

**Note:** `dora map` provides basic statistics only. For detailed code exploration:

- Use `dora symbol <query>` to find specific symbols
- Use `dora file <path>` to explore specific files with dependencies
- Use `dora deps`/`dora rdeps` to understand relationships

### dora ls [directory]

List files in a directory from the index with metadata.

**Arguments:**

- `[directory]` - Optional directory path to list. Omit to list all files. Uses SQL LIKE pattern matching (`directory/%`).

**Flags:**

- `--limit <number>` - Maximum number of results (default: 100)
- `--sort <field>` - Sort by: `path`, `symbols`, `deps`, or `rdeps` (default: `path`)

**Query:**

```sql
SELECT
  f.path,
  f.symbol_count as symbols,
  f.dependency_count as dependencies,
  f.dependent_count as dependents
FROM files f
WHERE f.path LIKE ?
ORDER BY [selected_field]
LIMIT ?
```

**Output:**

```json
{
  "directory": "src/commands",
  "files": [
    {
      "path": "src/commands/shared.ts",
      "symbols": 35,
      "dependencies": 7,
      "dependents": 18
    }
  ],
  "total": 27
}
```

**Use Cases:**

- Browse files in a specific directory: `dora ls src/components`
- Find files with most symbols: `dora ls --sort symbols --limit 10`
- Find files with most dependencies: `dora ls --sort deps --limit 20`
- Find hub files (most dependents): `dora ls --sort rdeps --limit 10`

### dora file <path>

Queries:

```sql
-- Symbols in file
SELECT
  s.name,
  s.kind,
  s.start_line,
  s.end_line
FROM symbols s
JOIN files f ON f.id = s.file_id
WHERE f.path = ?
ORDER BY s.start_line;

-- Dependencies (files this file imports)
SELECT
  f.path as depends_on,
  d.symbols as symbols_used
FROM dependencies d
JOIN files f ON f.id = d.to_file_id
WHERE d.from_file_id = (SELECT id FROM files WHERE path = ?)
ORDER BY f.path;

-- Dependents (files that import this file)
SELECT
  f.path as dependent,
  d.symbol_count as ref_count
FROM dependencies d
JOIN files f ON f.id = d.from_file_id
WHERE d.to_file_id = (SELECT id FROM files WHERE path = ?)
ORDER BY d.symbol_count DESC;
```

Output:

```json
{
  "path": "apps/api-worker/src/context.ts",
  "symbols": [
    {
      "name": "PlatformContext",
      "kind": "type",
      "lines": [6, 21]
    }
  ],
  "depends_on": [
    { "path": "packages/app-auth/src/index.ts", "symbols": ["AuthSession"] }
  ],
  "depended_by": [
    { "path": "apps/api-worker/src/router/billing/router.ts", "refs": 81 }
  ]
}
```

**Note:** Does NOT include source code. Use Read tool to get file contents.

### dora symbol <query>

Search for symbols by name with automatic filtering of local symbols.

Query:

```sql
SELECT
  s.name,
  s.kind,
  f.path,
  s.start_line,
  s.end_line
FROM symbols s
JOIN files f ON f.id = s.file_id
WHERE s.name LIKE '%' || ? || '%'
  AND s.is_local = 0  -- Filter out local symbols (parameters, closure vars)
LIMIT ?;
```

Flags: --kind, --limit (default: 20)

Output:

```json
{
  "query": "Logger",
  "results": [
    {
      "name": "Logger",
      "kind": "interface",
      "path": "packages/app-utils/src/logger.ts",
      "lines": [7, 11]
    }
  ]
}
```

**Note:** Symbol kinds are automatically extracted from SCIP documentation strings since scip-typescript doesn't populate the kind field.

### dora deps <path> [--depth N]

Query:

```sql
WITH RECURSIVE dep_tree AS (
  -- Base case: start with the target file
  SELECT id, path, 0 as depth
  FROM files
  WHERE path = ?

  UNION

  -- Recursive case: find files that this file depends on
  SELECT DISTINCT f.id, f.path, dt.depth + 1
  FROM dep_tree dt
  JOIN dependencies d ON d.from_file_id = dt.id
  JOIN files f ON f.id = d.to_file_id
  WHERE dt.depth < ?
)
SELECT path, MIN(depth) as depth
FROM dep_tree
WHERE depth > 0
GROUP BY path
ORDER BY depth, path;
```

Default depth: 1

Output:

```json
{
  "path": "apps/api-worker/src/context.ts",
  "depth": 2,
  "dependencies": [
    { "path": "packages/app-auth/src/index.ts", "depth": 1 },
    { "path": "packages/app-db/src/data/index.ts", "depth": 1 },
    { "path": "packages/app-db/src/billing/client.ts", "depth": 2 }
  ]
}
```

### dora rdeps <path> [--depth N]

Query:

```sql
WITH RECURSIVE rdep_tree AS (
  -- Base case: start with the target file
  SELECT id, path, 0 as depth
  FROM files
  WHERE path = ?

  UNION

  -- Recursive case: find files that depend on this file
  SELECT DISTINCT f.id, f.path, rt.depth + 1
  FROM rdep_tree rt
  JOIN dependencies d ON d.to_file_id = rt.id
  JOIN files f ON f.id = d.from_file_id
  WHERE rt.depth < ?
)
SELECT path, MIN(depth) as depth
FROM rdep_tree
WHERE depth > 0
GROUP BY path
ORDER BY depth, path;
```

Default depth: 1

Output:

```json
{
  "path": "apps/api-worker/src/context.ts",
  "depth": 2,
  "dependents": [
    { "path": "apps/api-worker/src/router/billing/router.ts", "depth": 1 },
    { "path": "apps/api-worker/src/index.ts", "depth": 2 }
  ]
}
```

### dora adventure <from> <to>

Find shortest path between two files using BFS on the dependency graph.

Query both deps and rdeps, find intersection.

Output:

```json
{
  "from": "apps/api-worker/src/router/billing/router.ts",
  "to": "packages/app-utils/src/logger.ts",
  "path": [
    "apps/api-worker/src/router/billing/router.ts",
    "apps/api-worker/src/context.ts",
    "packages/app-utils/src/logger.ts"
  ],
  "distance": 2
}
```

## Documentation Commands

### dora docs [--type TYPE]

List all indexed documentation files.

**Purpose:** Discover what documentation exists in the project. Useful for AI agents to understand what documentation is available before searching or exploring.

**Flags:**
- `--type <type>` - Filter by document type (md, txt)

**Query:**

```sql
SELECT path, type, symbol_count, file_count, document_count
FROM documents
ORDER BY path;
```

**Output:**

```json
{
  "documents": [
    {
      "path": "README.md",
      "type": "markdown",
      "symbol_refs": 12,
      "file_refs": 4,
      "document_refs": 2
    },
    {
      "path": "docs/api.md",
      "type": "markdown",
      "symbol_refs": 8,
      "file_refs": 3,
      "document_refs": 0
    }
  ],
  "total": 2
}
```

**Use Cases:**
- Discover what documentation files exist in the project
- Filter documentation by type (markdown vs plain text)
- Quick overview of documentation coverage

**Note:** To find documentation about specific code, use `dora symbol` or `dora file` which include a `documented_in` field showing which docs reference that code.

---

### dora docs search <query>

Search through all indexed documentation files for specific text content.

**Purpose:** Full-text search across all documentation. Useful for finding mentions of concepts, keywords, or specific phrases in your project's documentation.

**Flags:**
- `--limit <number>` - Maximum number of results to return (default: 20)

**Query:**

```sql
SELECT
  d.path,
  d.type,
  d.symbol_count,
  d.file_count
FROM documents d
WHERE d.content LIKE '%' || ? || '%'
ORDER BY d.path
LIMIT ?;
```

**Output:**

```json
{
  "query": "authentication",
  "limit": 20,
  "results": [
    {
      "path": "docs/api.md",
      "type": "markdown",
      "symbol_refs": 8,
      "file_refs": 3
    },
    {
      "path": "docs/setup.md",
      "type": "markdown",
      "symbol_refs": 2,
      "file_refs": 1
    }
  ],
  "total": 2
}
```

**Use Cases:**
- Finding documentation about a specific topic
- Searching for configuration examples
- Locating documentation that needs updating
- Discovering related documentation across the project

---

### dora docs show <path>

Display metadata and references for a specific documentation file.

**Purpose:** Understand what a documentation file covers by showing which symbols and files it references, along with line numbers where references occur.

**Flags:**
- `--content` - Include the full document content in the output

**Queries:**

```sql
-- Get document metadata
SELECT path, type, content
FROM documents
WHERE path = ?;

-- Get symbol references with line numbers
SELECT
  s.name,
  s.kind,
  f.path,
  s.start_line,
  s.end_line,
  dsr.line as ref_line
FROM document_symbol_refs dsr
JOIN symbols s ON s.id = dsr.symbol_id
JOIN files f ON f.id = s.file_id
WHERE dsr.document_id = ? AND s.name != ''
ORDER BY dsr.line;

-- Get file references with line numbers
SELECT
  f.path,
  dfr.line as ref_line
FROM document_file_refs dfr
JOIN files f ON f.id = dfr.file_id
WHERE dfr.document_id = ?
ORDER BY dfr.line;
```

**Output (without --content):**

```json
{
  "path": "docs/authentication.md",
  "type": "markdown",
  "symbol_refs": [
    {
      "name": "AuthService",
      "kind": "class",
      "path": "src/auth/service.ts",
      "lines": [15, 42],
      "ref_line": 23
    },
    {
      "name": "validateToken",
      "kind": "function",
      "path": "src/auth/token.ts",
      "lines": [8, 12],
      "ref_line": 45
    }
  ],
  "file_refs": [
    {
      "path": "src/auth/config.ts",
      "ref_line": 12
    }
  ]
}
```

**Output (with --content):**

```json
{
  "path": "docs/authentication.md",
  "type": "markdown",
  "symbol_refs": [...],
  "file_refs": [...],
  "content": "# Authentication\n\nThis document describes..."
}
```

**Use Cases:**
- Understanding what code a documentation file covers
- Finding exact line numbers where symbols/files are mentioned
- Verifying documentation accuracy against code
- Reviewing documentation coverage for specific features

---

**What Files Are Indexed:**

The documentation indexer automatically processes these file types:
- `.md` - Markdown files
- `.txt` - Plain text documentation

**Exclusions:**
- Respects `.gitignore` patterns
- Auto-ignores: `node_modules/`, `.git/`, `.dora/`, `dist/`, `build/`, `coverage/`, `.next/`, `.nuxt/`, `out/`, `*.log`

**Integration with Other Commands:**

Documentation references are automatically included in:
- `dora status` - Shows document count and breakdown by type
- `dora symbol <query>` - Shows which docs mention the symbol (via `documented_in` field)
- `dora file <path>` - Shows which docs reference the file (via `documented_in` field)

## Architecture Analysis Commands

### dora cycles [--limit N]

Find bidirectional dependencies (files that import each other).

**Purpose:** Identify 2-node circular dependencies where A imports B and B imports A. These are the most common and impactful architectural code smells.

**Note:** This command only detects 2-node cycles. For longer cycles (A → B → C → A), use the `dora query` command with custom SQL.

**Default:** `--limit 50`

Query:

```sql
SELECT
  f1.path as path1,
  f2.path as path2
FROM dependencies d1
JOIN dependencies d2 ON d1.from_file_id = d2.to_file_id
                     AND d1.to_file_id = d2.from_file_id
JOIN files f1 ON f1.id = d1.from_file_id
JOIN files f2 ON f2.id = d1.to_file_id
WHERE f1.path < f2.path  -- avoid duplicates
ORDER BY f1.path, f2.path
LIMIT ?;
```

Output:

```json
{
  "cycles": [
    {
      "files": [
        "src/billing.ts",
        "src/billing-subscription.ts",
        "src/billing.ts"
      ],
      "length": 2
    }
  ]
}
```

**Interpretation:**

- Empty result = No bidirectional dependencies
- Cycles found = Refactor to break the cycle (extract shared types, merge files, or make dependency one-way)

**Related:** Use `dora coupling` to see how many symbols are shared between bidirectional dependencies.

---

### dora coupling [--threshold N]

Find tightly coupled file pairs (bidirectional dependencies).

**Purpose:** Identify files that import symbols from each other, indicating potential for refactoring.

Query:

```sql
SELECT
  f1.path as file1,
  f2.path as file2,
  d1.symbol_count as symbols_1_to_2,
  d2.symbol_count as symbols_2_to_1,
  (d1.symbol_count + d2.symbol_count) as total_coupling
FROM dependencies d1
JOIN dependencies d2 ON d1.from_file_id = d2.to_file_id
                     AND d1.to_file_id = d2.from_file_id
JOIN files f1 ON f1.id = d1.from_file_id
JOIN files f2 ON f2.id = d1.to_file_id
WHERE f1.path < f2.path
  AND (d1.symbol_count + d2.symbol_count) >= ?
ORDER BY total_coupling DESC;
```

Default threshold: 5

Output:

```json
{
  "threshold": 5,
  "coupled_files": [
    {
      "file1": "src/billing.ts",
      "file2": "src/billing-subscription.ts",
      "symbols_1_to_2": 2,
      "symbols_2_to_1": 1,
      "total_coupling": 3
    }
  ]
}
```

**Interpretation:**

- Low coupling (< 5) = Files share a few types, normal
- High coupling (> 20) = Consider merging or extracting shared module

---

### dora complexity [--sort metric]

Show file complexity metrics for refactoring prioritization.

**Purpose:** Identify files that are risky to change based on size, dependencies, and impact.

Query:

```sql
SELECT
  f.path,
  f.symbol_count,
  f.dependency_count as outgoing_deps,
  f.dependent_count as incoming_deps,
  CAST(f.dependent_count AS FLOAT) / NULLIF(f.dependency_count, 1) as stability_ratio,
  (f.symbol_count * f.dependent_count) as complexity_score
FROM files f
ORDER BY [selected_metric] DESC
LIMIT 20;
```

Flags: --sort (complexity | symbols | stability)

**Metrics:**

- `symbol_count` - Proxy for lines of code
- `outgoing_deps` - Files this file imports from
- `incoming_deps` - Files that import from this file (fan-in)
- `stability_ratio` - incoming / outgoing (high = stable, hard to change)
- `complexity_score` - symbols × incoming deps (high = risky to change)

Output:

```json
{
  "sort_by": "complexity",
  "files": [
    {
      "path": "src/types.ts",
      "symbol_count": 180,
      "outgoing_deps": 0,
      "incoming_deps": 52,
      "stability_ratio": null,
      "complexity_score": 9360
    }
  ]
}
```

**Interpretation:**

- High complexity score (> 5000) = High-impact file, changes affect many files
- High stability ratio (> 5) = Stable interface, expensive to change
- Low incoming deps (< 3) = Good refactoring candidate

---

## Additional Commands

### dora refs <symbol>

Find all references to a symbol across the codebase.

**Performance:** Uses single optimized query with GROUP_CONCAT (no N+1 queries).

Output includes definition location and all files that reference the symbol.

---

### dora lost [--limit N]

Find potentially unused symbols (zero references).

**Performance:** Uses denormalized `reference_count` field for instant results.

Query:

```sql
SELECT s.name, s.kind, f.path, s.start_line, s.end_line
FROM symbols s
JOIN files f ON f.id = s.file_id
WHERE s.is_local = 0
  AND s.reference_count = 0
  AND s.kind NOT IN ('module', 'parameter')
ORDER BY f.path, s.start_line
LIMIT ?;
```

---

### dora treasure [--limit N]

Show most referenced files and files with most dependencies.

**Performance:** Uses denormalized `dependent_count` and `dependency_count` fields.

Output:

```json
{
  "most_referenced": [{ "file": "src/types.ts", "count": 52 }],
  "most_dependencies": [{ "file": "src/app.tsx", "count": 27 }]
}
```

---

### dora changes [ref]

Show files changed since git ref and their impact.

---

### dora exports <path|package>

List exported symbols from a file or package.

---

### dora imports <path>

Show all imports for a file.

---

### dora leaves [--max-dependents N]

Find leaf nodes (files with few dependents but have dependencies).

**Default:** `--max-dependents 0` (files with zero dependents)

---

### dora graph <path> [--direction] [--depth]

Generate dependency graph data.

---

### dora schema

Show the complete database schema including tables, columns, types, and indexes.

**Purpose:** Provides the schema needed for AI agents to write custom SQL queries using `dora query`.

Output:

```json
{
  "tables": [
    {
      "name": "files",
      "columns": [
        {
          "name": "id",
          "type": "INTEGER",
          "nullable": true,
          "primary_key": true
        },
        {
          "name": "path",
          "type": "TEXT",
          "nullable": false,
          "primary_key": false
        }
      ],
      "indexes": ["CREATE INDEX idx_files_path ON files(path)"]
    }
  ]
}
```

**Key Tables:**

- `files` - File metadata (path, language, mtime, symbol_count, dependency_count, dependent_count)
- `symbols` - Symbol definitions (name, kind, file_id, location, is_local, reference_count)
- `dependencies` - File-to-file dependencies (from_file_id, to_file_id, symbol_count, symbols)
- `symbol_references` - Symbol usage tracking (symbol_id, file_id, line)
- `packages` - External packages (name, manager, version, symbol_count)
- `metadata` - System metadata (key-value pairs)

---

### dora cookbook [recipe]

Show query pattern cookbook with examples and tips for common SQL patterns.

**Purpose:** Provides ready-to-use SQL query patterns for AI agents and users who want to explore the database without needing to learn the schema first. All recipes include real examples tested on actual codebases.

**Flags:**
- `[recipe]` - Optional recipe name. Omit to see all available recipes.

**Available Recipes:**
- `quickstart` - Complete walkthrough exploring a codebase from scratch with real-world workflows
- `methods` - Finding class methods by name, finding all methods in a class, counting method usages
- `references` - Tracking symbol usage, finding most referenced symbols, identifying dead code
- `exports` - Distinguishing exported symbols from internal ones, finding public API functions/types

**Output:**

```json
{
  "recipe": "quickstart",
  "content": "# Dora Quickstart: Exploring a Codebase\n\nA practical walkthrough..."
}
```

**Usage:**

```bash
# Show all available recipes
dora cookbook

# Show quickstart guide
dora cookbook quickstart

# Show methods recipe
dora cookbook methods

# Show references recipe
dora cookbook references

# Show exports recipe
dora cookbook exports
```

**Use Cases:**
- **New to dora?** Start with `dora cookbook quickstart` for a complete walkthrough
- Discovering query patterns for common tasks
- Learning how to use `dora query` effectively
- Finding SQL examples for specific use cases
- Understanding how to query methods, references, and exported symbols

**Integration with Other Commands:**
- Use `dora schema` to understand the database structure
- Use `dora query` to execute the SQL patterns shown in recipes
- Copy-paste SQL examples directly from cookbook output into `dora query`

**Custom Cookbooks:**
You can add your own cookbook recipes by creating markdown files in `.dora/cookbooks/`. Each file becomes a recipe that can be accessed with `dora cookbook <filename>` (without the .md extension).

Example: Create `.dora/cookbooks/my-patterns.md` with your custom SQL patterns, then access it with `dora cookbook my-patterns`.

---

### dora query "<sql>"

Execute arbitrary SQL queries against the database (read-only).

**Purpose:** Enables ad-hoc analysis and custom queries not covered by built-in commands. AI agents can use this to explore the database and answer complex questions about the codebase.

**Safety:** Only SELECT queries are allowed. INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, TRUNCATE, and REPLACE operations are blocked.

**Usage:**

```bash
# Find files with most symbols
dora query "SELECT path, symbol_count FROM files ORDER BY symbol_count DESC LIMIT 10"

# Count symbols by kind
dora query "SELECT kind, COUNT(*) as count FROM symbols WHERE is_local = 0 GROUP BY kind ORDER BY count DESC"

# Find files with bidirectional dependencies
dora query "SELECT f1.path as file1, f2.path as file2 FROM dependencies d1 JOIN dependencies d2 ON d1.from_file_id = d2.to_file_id AND d1.to_file_id = d2.from_file_id JOIN files f1 ON f1.id = d1.from_file_id JOIN files f2 ON f2.id = d1.to_file_id WHERE f1.path < f2.path"

# Analyze symbol distribution per file
dora query "SELECT f.path, COUNT(s.id) as symbols, AVG(s.reference_count) as avg_refs FROM files f JOIN symbols s ON s.file_id = f.id WHERE s.is_local = 0 GROUP BY f.path ORDER BY symbols DESC LIMIT 20"
```

Output:

```json
{
  "query": "SELECT path, symbol_count FROM files ORDER BY symbol_count DESC LIMIT 5",
  "rows": [
    { "path": "src/converter/scip_pb.ts", "symbol_count": 1640 },
    { "path": "src/proto/scip.proto", "symbol_count": 86 }
  ],
  "row_count": 2,
  "columns": ["path", "symbol_count"]
}
```

**Tips for AI Agents:**

- Use `dora schema` first to understand the database structure
- Filter local symbols with `WHERE is_local = 0` for cleaner results
- Use denormalized fields (`reference_count`, `dependent_count`, `dependency_count`) for fast queries
- JOIN tables to correlate symbols, files, and dependencies
- Use GROUP BY and aggregates (COUNT, SUM, AVG) for statistical analysis

## CLI Entry Point

The CLI uses the Commander library for argument parsing:

```typescript
// src/index.ts (simplified)
import { Command } from "commander";

const program = new Command();

program
  .name("dora")
  .description("Code Context CLI for AI Agents")
  .version("1.0.0");

// Setup commands
// init, index, status, overview

// Query commands
// file, symbol, refs, deps, rdeps, path

// Analysis commands
// cycles, coupling, complexity, hotspots, unused, leaves

// Additional commands
// changes, exports, imports, graph

program.parse();
```

## Output Rules

1. Always output valid JSON to stdout
2. Errors go to stderr as JSON: `{"error": "message"}`
3. No extra logging or formatting
4. Exit code 0 on success, 1 on error

## Dependencies

```json
{
  "name": "dora",
  "type": "module",
  "bin": {
    "dora": "./src/index.ts"
  },
  "dependencies": {},
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.0.0"
  }
}
```

## Debug Logging

The CLI uses the [`debug`](https://www.npmjs.com/package/debug) library for logging. Control logging via the `DEBUG` environment variable:

```bash
# Show all dora debug output
DEBUG=dora:* dora index

# Show only converter logs
DEBUG=dora:converter dora index

# Show multiple namespaces
DEBUG=dora:index,dora:converter dora index

# Show all debug logs from all libraries
DEBUG=* dora index
```

Available namespaces:

- `dora:index` - Index command logs
- `dora:converter` - SCIP to DB conversion logs
- `dora:db` - Database operation logs
- `dora:config` - Configuration logs

## Performance Optimizations

The doraCLI uses several optimization strategies for fast queries on large codebases:

### 1. Denormalized Fields

Pre-computed aggregates stored in the database for instant lookups:

- `files.symbol_count` - Number of symbols per file
- `files.dependency_count` - Outgoing dependencies
- `files.dependent_count` - Incoming dependencies (fan-in)
- `symbols.reference_count` - Number of references to each symbol

**Impact:** 10-50x faster queries. No expensive COUNT() aggregations at query time.

### 2. Symbol Kind Extraction

Since scip-typescript doesn't populate the `kind` field, we extract symbol kinds from documentation strings:

- Pattern matching on documentation like `"interface Logger"`, `"(property) name: string"`
- Supports: class, interface, type, function, method, property, parameter, variable, enum, etc.
- Stored in indexed `symbols.kind` column for fast filtering

### 3. Local Symbol Filtering

Local symbols (function parameters, closure variables) are flagged with `is_local = 1`:

- Reduces noise in symbol searches
- Indexed boolean column for fast filtering
- ~15-20% of symbols are local and filtered by default

### 4. Optimized Queries

- Symbol references: Single JOIN query with GROUP_CONCAT (no N+1 queries)
- Unused symbols: Index lookup on `reference_count = 0`
- Hotspots: Direct lookup on denormalized counts
- Cycles: Recursive CTE with visit tracking

### 5. Incremental Indexing

- Only reindex files that changed (based on mtime)
- Full reindex only when forced or on first run
- Denormalized fields updated after each indexing operation

## Notes

- The database schema is defined in `src/converter/schema.sql` and created in `src/converter/convert.ts`
- SCIP protobuf files are parsed directly using `@bufbuild/protobuf`
- Source text is NOT in the database - use the Read tool to get file contents
- All paths in the database are relative to repo root
- Symbol strings (SCIP identifiers) look like: `scip-typescript npm @package/name 1.0.0 src/\`file.ts\`/SymbolName#`
- The converter supports both full and incremental builds based on git state and file mtimes
- Database uses optimized schema with denormalized data for fast queries
- Pre-computed dependencies and symbol references for O(1) lookups

## Typical Workflow for AI Agents

```bash
# 1. Initialize in a TypeScript project
dora init

# 2. Index the codebase
dora index

# 3. Understand the codebase structure
dora map
dora treasure --limit 20

# 4. Find specific code
dora symbol AuthService
dora file src/auth/service.ts

# 5. Analyze architecture
dora cycles  # Check for circular dependencies
dora coupling --threshold 5  # Find tightly coupled files
dora complexity --sort complexity  # Find high-impact files

# 6. Impact analysis before changes
dora rdeps src/types.ts --depth 2  # What depends on this?
dora lost --limit 50  # Find dead code

# 7. Navigate dependencies
dora deps src/app.ts --depth 2
dora adventure src/component.tsx src/utils.ts

# 8. Advanced custom queries
dora cookbook methods  # Learn how to query methods
dora query "<sql>"     # Execute custom SQL queries
```
