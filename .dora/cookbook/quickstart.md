# Dora Quickstart: Exploring a Codebase

A practical walkthrough showing how to use dora to understand an unfamiliar codebase from scratch.

## Scenario: Understanding the dora Commands System

You're new to the dora codebase and want to understand how commands are organized. Let's walk through exploring the codebase using dora.

---

## Step 1: Get the Big Picture

Start with a high-level overview of the entire codebase.

```bash
dora map
```

**Result:**
```json
{
  "packages": ["@butttons/dora", "docs"],
  "file_count": 86,
  "symbol_count": 31192
}
```

**Insight:** 86 files with 31K symbols. This is a medium-sized TypeScript project.

---

## Step 2: Explore Directory Structure

Browse the commands directory to see what's there.

```bash
dora ls src/commands --sort symbols --limit 5
```

**Result:**
```json
{
  "files": [
    {"path": "src/commands/shared.ts", "symbols": 55, "dependencies": 6, "dependents": 22},
    {"path": "src/commands/ls.ts", "symbols": 40, "dependencies": 2, "dependents": 3},
    {"path": "src/commands/adventure.ts", "symbols": 38, "dependencies": 5, "dependents": 3}
  ]
}
```

**Insight:** `shared.ts` has 22 dependents - it's a central utility file.

---

## Step 3: Understand a Key File

Examine the shared utilities file in detail.

```bash
dora file src/commands/shared.ts
```

**Result shows:**
- Exported symbols: `setupCommand`, `parseIntFlag`, `parseStringFlag`, etc.
- Dependencies: imports from `commander`, `./output`, `./config`
- Dependents: 22 command files import from it

**Insight:** This file provides shared utilities that all commands use.

---

## Step 4: Find What Depends On It

See which commands use the shared utilities.

```bash
dora rdeps src/commands/shared.ts --depth 1
```

**Result:**
```json
{
  "dependents": [
    {"path": "src/commands/adventure.ts", "depth": 1},
    {"path": "src/commands/changes.ts", "depth": 1},
    {"path": "src/commands/deps.ts", "depth": 1}
  ]
}
```

**Insight:** Nearly every command file imports from `shared.ts`.

---

## Step 5: Analyze Code Composition

Use custom SQL to understand what types of code exist in commands.

```bash
dora query "SELECT s.kind, COUNT(*) as count FROM symbols s JOIN files f ON s.file_id = f.id WHERE f.path LIKE 'src/commands/%' AND s.is_local = 0 GROUP BY s.kind ORDER BY count DESC"
```

**Result:**
```json
{
  "rows": [
    {"kind": "property", "count": 73},
    {"kind": "parameter", "count": 62},
    {"kind": "function", "count": 38},
    {"kind": "module", "count": 28},
    {"kind": "interface", "count": 7}
  ]
}
```

**Insight:** The commands directory has 38 functions - likely one main function per command file.

---

## Step 6: Identify Hub Files

Find the most important files by seeing which have the most dependents.

```bash
dora query "SELECT f.path, f.symbol_count, f.dependent_count FROM files f WHERE f.path LIKE 'src/commands/%' ORDER BY f.dependent_count DESC LIMIT 5"
```

**Result:**
```json
{
  "rows": [
    {"path": "src/commands/shared.ts", "symbol_count": 55, "dependent_count": 22},
    {"path": "src/commands/complexity.ts", "symbol_count": 7, "dependent_count": 4}
  ]
}
```

**Insight:** `shared.ts` is the critical hub - changes here affect 22 files.

---

## Step 7: Find Heavily Used Functions

Discover which functions are most referenced across the codebase.

```bash
dora query "SELECT s.name, s.kind, s.reference_count, f.path FROM symbols s JOIN files f ON s.file_id = f.id WHERE s.is_local = 0 AND s.reference_count > 20 AND f.path LIKE 'src/%' ORDER BY s.reference_count DESC LIMIT 10"
```

**Result:**
```json
{
  "rows": [
    {"name": "debugConverter.", "kind": "variable", "reference_count": 69, "path": "src/utils/logger.ts"},
    {"name": "outputJson().", "kind": "function", "reference_count": 46, "path": "src/utils/output.ts"},
    {"name": "setupCommand().", "kind": "function", "reference_count": 40, "path": "src/commands/shared.ts"}
  ]
}
```

**Insight:** `setupCommand` is used in 40 places - it's the standard way to create commands.

---

## Step 8: Trace Usage of a Key Function

Find everywhere `setupCommand` is called.

```bash
dora query "SELECT f.path, COUNT(*) as usage_count FROM symbol_references sr JOIN symbols s ON sr.symbol_id = s.id JOIN files f ON sr.file_id = f.id WHERE s.name = 'setupCommand().' GROUP BY f.path ORDER BY usage_count DESC LIMIT 10"
```

**Result:**
```json
{
  "rows": [
    {"path": "src/commands/treasure.ts", "usage_count": 2},
    {"path": "src/commands/symbol.ts", "usage_count": 2},
    {"path": "src/commands/schema.ts", "usage_count": 2}
  ]
}
```

**Insight:** Each command file calls `setupCommand` twice (likely for setup and execution).

---

## Step 9: Understand the Pattern

Look at a specific command to understand the structure.

```bash
dora file src/commands/complexity.ts
```

**Symbols found:**
- `complexity()` function
- Imports from `shared.ts` (setupCommand, parseIntFlag)
- Imports from query utilities

**Pattern Discovered:** Each command file:
1. Imports setupCommand from shared.ts
2. Defines a main command function
3. Uses setupCommand to register with Commander

---

## Key Takeaways from This Exploration

Using dora, we discovered:

1. **Architecture:** Commands follow a consistent pattern using shared utilities
2. **Central files:** `shared.ts` is the hub (22 dependents)
3. **Key functions:** `setupCommand` is used 40 times across all commands
4. **Code composition:** 38 command functions across 28 command files
5. **Pattern:** Each command calls setupCommand twice (registration + execution)

All of this without reading a single line of code - just by querying the index.

---

## Common Workflows

### Workflow 1: "Where is X used?"
```bash
dora symbol <name>           # Find the symbol
dora refs <symbol>           # See all references
```

### Workflow 2: "What depends on this file?"
```bash
dora rdeps <path> --depth 2  # Find reverse dependencies
```

### Workflow 3: "What are the most important files?"
```bash
dora ls --sort rdeps         # Sort by dependents (fan-in)
dora treasure                # Find hub files
```

### Workflow 4: "What's the code composition?"
```bash
dora query "SELECT kind, COUNT(*) FROM symbols WHERE is_local = 0 GROUP BY kind"
```

### Workflow 5: "Find architectural patterns"
```bash
dora cycles                  # Find circular dependencies
dora coupling                # Find tightly coupled files
dora complexity              # Find high-impact files
```

---

## Next Steps

Now that you understand the basics, dive deeper with specialized recipes:

- **dora cookbook methods** - Finding and analyzing class methods
- **dora cookbook references** - Tracking symbol usage patterns
- **dora cookbook exports** - Distinguishing public APIs from internals

Or explore custom queries:
- **dora schema** - See the full database structure
- **dora query "<sql>"** - Run any SQL query against the index
