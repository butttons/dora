# Finding Exported Symbols

Distinguish between exported (public API) and internal symbols in your codebase.

## Why This Recipe?

The existing `dora exports <path>` command includes local symbols (parameters, variables). This recipe shows how to find only exported functions, types, classes, and interfaces using custom SQL queries.

## Find All Exported Functions in a Directory

```sql
SELECT f.path, s.name, s.start_line
FROM symbols s
JOIN files f ON s.file_id = f.id
WHERE f.path LIKE 'src/commands/%'
  AND s.kind = 'function'
  AND s.is_local = 0
ORDER BY f.path, s.start_line
```

**Use case:** List all command functions in the commands directory

## Find Exported Functions in a Specific File

```sql
SELECT s.name, s.kind, s.start_line
FROM symbols s
JOIN files f ON s.file_id = f.id
WHERE f.path = 'src/commands/shared.ts'
  AND s.kind = 'function'
  AND s.is_local = 0
ORDER BY s.start_line
```

**Use case:** See the public API of a utility module

## Find All Exported Types and Interfaces

```sql
SELECT s.name, s.kind, s.start_line
FROM symbols s
JOIN files f ON s.file_id = f.id
WHERE f.path = 'src/types.ts'
  AND s.kind IN ('interface', 'type')
  AND s.is_local = 0
ORDER BY s.start_line
```

**Use case:** List all type definitions in your types file

## Group Exported Symbols by Kind

```sql
SELECT s.kind, COUNT(*) as count
FROM symbols s
JOIN files f ON s.file_id = f.id
WHERE f.path LIKE 'src/commands/%'
  AND s.is_local = 0
GROUP BY s.kind
ORDER BY count DESC
```

**Use case:** Understand the composition of your public API (how many functions vs types vs classes)

## Real Examples from dora Codebase

### List all command functions
```bash
dora query "SELECT f.path, s.name FROM symbols s JOIN files f ON s.file_id = f.id WHERE f.path LIKE 'src/commands/%' AND s.kind = 'function' AND s.is_local = 0 ORDER BY f.path"
```

**Result:** adventure, changes, complexity, cookbook, coupling, cycles, deps, file, graph, imports, index, init, leaves, lost, ls, map, query, rdeps, refs, schema, status, symbol, treasure

### Find exported utilities in shared.ts
```bash
dora query "SELECT s.name FROM symbols s JOIN files f ON s.file_id = f.id WHERE f.path = 'src/commands/shared.ts' AND s.kind = 'function' AND s.is_local = 0"
```

**Result:** setupCommand, parseIntFlag, parseStringFlag, getRepoRoot

### Count exported symbols by kind
```bash
dora query "SELECT s.kind, COUNT(*) as count FROM symbols s WHERE s.is_local = 0 GROUP BY s.kind ORDER BY count DESC"
```

**Result:** Shows distribution across the codebase (functions, interfaces, types, classes, etc.)

## Key Concepts

**is_local flag:**
- `is_local = 0` → Exported symbols (public API)
- `is_local = 1` → Local symbols (function parameters, closure variables, private helpers)

**kind field:**
- `function` - Functions and methods
- `interface` - TypeScript interfaces
- `type` - Type aliases
- `class` - Class definitions
- `enum` - Enumerations
- `property` - Class/object properties
- `variable` - Module-level variables

## Tips

- Always filter by `s.is_local = 0` to exclude internal symbols
- Use `s.kind IN ('function', 'class')` to find multiple kinds
- Combine with `f.path LIKE` patterns to filter by directory
- Use `GROUP BY s.kind` to analyze API composition
