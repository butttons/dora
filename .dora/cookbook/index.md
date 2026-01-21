# Writing Custom Queries with dora

The `dora query` command lets you write custom SQL queries against the indexed codebase.

## Getting Started

1. View the database structure:
```bash
dora schema
```

2. Explore available recipes:
```bash
dora cookbook --help
```

3. Execute your query:
```bash
dora query "SELECT * FROM files LIMIT 5"
```

## Available Recipes

Browse these specialized query patterns for common use cases:

- **quickstart** - Complete walkthrough exploring a codebase from scratch, real-world workflows
- **methods** - Finding class methods by name, finding all methods in a class, counting method usages
- **references** - Tracking symbol usage, finding most referenced symbols, identifying dead code
- **exports** - Distinguishing exported symbols from internal ones, finding public API functions/types

## Common JOIN Patterns

### Symbols with their files
```sql
SELECT s.name, s.kind, f.path
FROM symbols s
JOIN files f ON s.file_id = f.id
WHERE s.is_local = 0
```

### Symbol references with locations
```sql
SELECT s.name, f.path, sr.line
FROM symbol_references sr
JOIN symbols s ON sr.symbol_id = s.id
JOIN files f ON sr.file_id = f.id
WHERE s.name = 'MyClass'
```

### File dependencies
```sql
SELECT f1.path as from_file, f2.path as to_file
FROM dependencies d
JOIN files f1 ON d.from_file_id = f1.id
JOIN files f2 ON d.to_file_id = f2.id
WHERE f1.path LIKE 'src/components/%'
```

## Performance Tips

**Use denormalized fields** for fast queries:
- `files.symbol_count` - Number of symbols in file
- `files.dependency_count` - Outgoing dependencies
- `files.dependent_count` - Incoming dependencies (fan-in)
- `symbols.reference_count` - Number of references to symbol

**Filter local symbols** to reduce noise:
```sql
WHERE s.is_local = 0
```

**Use LIMIT** for large result sets:
```sql
LIMIT 50
```

## Common Aggregations

### Count symbols by kind
```sql
SELECT kind, COUNT(*) as count
FROM symbols
WHERE is_local = 0
GROUP BY kind
ORDER BY count DESC
```

### Find files with most symbols
```sql
SELECT path, symbol_count
FROM files
ORDER BY symbol_count DESC
LIMIT 20
```

### Most referenced symbols
```sql
SELECT s.name, s.kind, s.reference_count
FROM symbols s
WHERE s.is_local = 0
ORDER BY s.reference_count DESC
LIMIT 20
```

## Tips

- Use `LIKE '%pattern%'` for fuzzy matching
- Join with `files` to get readable paths instead of IDs
- Use `GROUP BY` and aggregates for statistics
- Check specific recipes with `dora cookbook <recipe>` for detailed examples
