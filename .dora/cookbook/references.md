# Finding Symbol References

Track where symbols (functions, types, interfaces, variables) are used across the codebase.

## Why This Recipe?

The `symbol_references` table tracks every usage of a symbol. This is different from `dora refs` which may have limitations. Use these queries to find exact usage locations, analyze symbol popularity, and identify dead code.

## Find Where a Symbol is Used

```sql
SELECT f.path, sr.line
FROM symbol_references sr
JOIN symbols s ON sr.symbol_id = s.id
JOIN files f ON sr.file_id = f.id
WHERE s.name = 'outputJson().'
ORDER BY f.path, sr.line
```

**Use case:** Find all files that call the `outputJson` function

## Count References Per File

```sql
SELECT f.path, COUNT(*) as count
FROM symbol_references sr
JOIN symbols s ON sr.symbol_id = s.id
JOIN files f ON sr.file_id = f.id
WHERE s.name = 'outputJson().'
GROUP BY f.path
ORDER BY count DESC
```

**Use case:** Identify which files use a function most frequently

## Find Total References for a Symbol

```sql
SELECT s.name, COUNT(sr.id) as total_refs
FROM symbols s
LEFT JOIN symbol_references sr ON s.id = sr.symbol_id
WHERE s.name LIKE 'setupCommand%'
GROUP BY s.name
```

**Use case:** Check how many times a symbol is referenced in total

## Find Most Referenced Symbols

```sql
SELECT s.name, s.kind, s.reference_count, f.path
FROM symbols s
JOIN files f ON s.file_id = f.id
WHERE s.is_local = 0
  AND s.reference_count > 5
  AND f.path LIKE 'src/%'
ORDER BY s.reference_count DESC
LIMIT 20
```

**Use case:** Identify the most heavily used symbols in your codebase

## Find Interface/Type References

```sql
SELECT f.path, sr.line
FROM symbol_references sr
JOIN symbols s ON sr.symbol_id = s.id
JOIN files f ON sr.file_id = f.id
WHERE s.name = 'DependencyNode'
  AND s.kind = 'interface'
ORDER BY f.path, sr.line
```

**Use case:** Find where a specific interface or type is used

## Find Symbols with No References

```sql
SELECT s.name, s.kind, f.path
FROM symbols s
JOIN files f ON s.file_id = f.id
WHERE s.is_local = 0
  AND s.reference_count = 0
  AND s.kind NOT IN ('module', 'parameter')
ORDER BY f.path, s.name
LIMIT 20
```

**Use case:** Identify potentially unused symbols (dead code)

## Real Examples from dora Codebase

### Find where outputJson is called
```bash
dora query "SELECT f.path, sr.line FROM symbol_references sr JOIN symbols s ON sr.symbol_id = s.id JOIN files f ON sr.file_id = f.id WHERE s.name = 'outputJson().' ORDER BY f.path, sr.line LIMIT 10"
```

**Result:** Used in complexity.ts:6,30, coupling.ts:6,23, cycles.ts:6,22

### Count outputJson usage per file
```bash
dora query "SELECT f.path, COUNT(*) as count FROM symbol_references sr JOIN symbols s ON sr.symbol_id = s.id JOIN files f ON sr.file_id = f.id WHERE s.name = 'outputJson().' GROUP BY f.path ORDER BY count DESC"
```

**Result:** cycles.ts (2 uses), coupling.ts (2 uses), complexity.ts (2 uses)

### Find total references to setupCommand
```bash
dora query "SELECT s.name, COUNT(sr.id) as total_refs FROM symbols s LEFT JOIN symbol_references sr ON s.id = sr.symbol_id WHERE s.name LIKE 'setupCommand%' GROUP BY s.name"
```

**Result:** setupCommand has 116 total references

### Find most referenced symbols in src/
```bash
dora query "SELECT s.name, s.kind, s.reference_count, f.path FROM symbols s JOIN files f ON s.file_id = f.id WHERE s.is_local = 0 AND s.reference_count > 5 AND f.path LIKE 'src/%' ORDER BY s.reference_count DESC LIMIT 10"
```

**Result:** debugConverter (69 refs), outputJson (46 refs), setupCommand (40 refs), CommandContext (34 refs)

### Find DependencyNode interface usage
```bash
dora query "SELECT f.path, sr.line FROM symbol_references sr JOIN symbols s ON sr.symbol_id = s.id JOIN files f ON sr.file_id = f.id WHERE s.name = 'DependencyNode' AND s.kind = 'interface' ORDER BY f.path, sr.line"
```

**Result:** Used in src/types.ts at lines 100 and 106

## Key Concepts

**Symbol Names:**
- Functions include trailing `().` - Example: `outputJson().`
- Interfaces/types are plain names - Example: `DependencyNode`
- Always check the exact name format with `dora symbol <name>` first

**Reference Count:**
- `reference_count` is a denormalized field on the symbols table
- Pre-computed for fast lookups without joining symbol_references
- Use this for filtering and sorting by popularity

**is_local flag:**
- `is_local = 0` → Exported symbols (functions, types, interfaces)
- `is_local = 1` → Local symbols (parameters, closure variables)
- Always filter by `is_local = 0` to find meaningful references

## Tips

- Use `s.name` for exact symbol name matching
- Use `s.scip_symbol LIKE` for partial matching across packages
- Join with `files` table to get readable paths
- Use `GROUP BY` for aggregated statistics
- Filter `s.is_local = 0` to exclude local variables
- Use `s.reference_count` for fast filtering without joining symbol_references
- Check symbol name format first with `dora symbol <name>` before writing queries
- Combine with `s.kind` to filter by symbol type (function, interface, type, etc.)
