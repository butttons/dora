# Finding Methods

Class methods are indexed with their full class path in the scip_symbol column using the pattern `ClassName#methodName()`.

## Why This Recipe?

Methods are tracked differently than regular functions. They include the class name in their SCIP symbol (e.g., `Logger#info()`) which allows precise lookups and differentiation between methods with the same name in different classes.

## Find a Specific Method Definition

```sql
SELECT f.path, s.start_line, s.name
FROM symbols s
JOIN files f ON s.file_id = f.id
WHERE s.scip_symbol LIKE '%Logger#info%'
```

**Use case:** Find where the `info` method is defined in the Logger class

## Find All Methods in a Class

```sql
SELECT s.name, f.path, s.start_line
FROM symbols s
JOIN files f ON s.file_id = f.id
WHERE s.scip_symbol LIKE '%Application#%'
  AND s.kind = 'method'
  AND s.is_local = 0
ORDER BY s.start_line
```

**Use case:** List all methods in the Application class

## Find Where a Method is Used

```sql
SELECT DISTINCT f.path, sr.line
FROM symbol_references sr
JOIN symbols s ON sr.symbol_id = s.id
JOIN files f ON sr.file_id = f.id
WHERE s.scip_symbol LIKE '%Logger#info%'
ORDER BY f.path, sr.line
```

**Use case:** Find all files that call Logger.info()

## Count Method Usages by File

```sql
SELECT f.path, COUNT(DISTINCT sr.line) as usage_count
FROM symbol_references sr
JOIN symbols s ON sr.symbol_id = s.id
JOIN files f ON sr.file_id = f.id
WHERE s.scip_symbol LIKE '%Application#start%'
GROUP BY f.path
ORDER BY usage_count DESC
```

**Use case:** Identify which files use a method most frequently

## Find Getter and Setter Methods

```sql
SELECT s.name, f.path, s.start_line
FROM symbols s
JOIN files f ON s.file_id = f.id
WHERE s.kind = 'method'
  AND s.is_local = 0
  AND (s.scip_symbol LIKE '%#set%' OR s.scip_symbol LIKE '%#get%')
LIMIT 20
```

**Use case:** Find all getter/setter methods in the codebase

## Real Examples from dora Codebase

### Find Logger info method
```bash
dora query "SELECT f.path, s.start_line, s.name FROM symbols s JOIN files f ON s.file_id = f.id WHERE s.scip_symbol LIKE '%Logger#info%'"
```

**Result:** Finds info() method in Logger class at test/fixtures/sample.ts:3

### Find all Application methods
```bash
dora query "SELECT s.name, s.start_line FROM symbols s JOIN files f ON s.file_id = f.id WHERE s.scip_symbol LIKE '%Application#%' AND s.kind = 'method' AND s.is_local = 0 ORDER BY s.start_line"
```

**Result:** start() at line 18, stop() at line 22

### Find where Logger.info is called
```bash
dora query "SELECT DISTINCT f.path, sr.line FROM symbol_references sr JOIN symbols s ON sr.symbol_id = s.id JOIN files f ON sr.file_id = f.id WHERE s.scip_symbol LIKE '%Logger#info%' ORDER BY f.path"
```

**Result:** Called in test/fixtures/app.ts at lines 19 and 23

### Find AstroError setter methods
```bash
dora query "SELECT s.scip_symbol FROM symbols s WHERE s.kind = 'method' AND s.is_local = 0 AND s.scip_symbol LIKE '%AstroError#set%' LIMIT 5"
```

**Result:** setLocation(), setName(), setMessage(), setHint(), setFrame()

## Key Concepts

**SCIP Symbol Format for Methods:**
- Pattern: `ClassName#methodName()`
- Example: `Logger#info()` - The `info` method in the `Logger` class
- The `#` separates the class name from the method name

**Method vs Function:**
- Methods have `kind = 'method'` and include `#` in scip_symbol
- Functions have `kind = 'function'` and use different format

**is_local flag:**
- `is_local = 0` → Class methods (public API)
- `is_local = 1` → Local helper methods

## Tips

- Always use `%ClassName#methodName%` pattern to find methods
- Use `%ClassName#%` to find all methods in a class
- Filter by `s.kind = 'method'` for more precise results
- Combine with `s.is_local = 0` to exclude local helpers
- Use `LIKE '%#set%'` or `LIKE '%#get%'` to find setters/getters
- Join with symbol_references to analyze method usage patterns
