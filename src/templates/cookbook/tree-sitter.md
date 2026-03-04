# Tree-Sitter Commands Cookbook

Tree-sitter commands provide intra-file analysis that complements SCIP's cross-file capabilities. Use these commands to understand code complexity, detect smells, and navigate class hierarchies before making changes.

## When to Use Each Command

| Command | Use Case | Data Source |
|---------|----------|-------------|
| `dora fn` | Analyze function complexity, identify hotspots | Tree-sitter |
| `dora class` | Navigate class hierarchies, understand inheritance | Tree-sitter |
| `dora smells` | Pre-refactor checklist, detect problematic code | Tree-sitter |
| `dora file` | Cross-file dependencies + intra-file metrics | SCIP + Tree-sitter |
| `dora symbol` | Find symbols across the codebase | SCIP |

**Rule of thumb:** Use tree-sitter commands for single-file deep analysis; use SCIP commands for cross-file relationships.

## Typical AI Agent Workflow

Before editing a file, always run `dora fn` to understand complexity hotspots:

```bash
# 1. Get file overview with dependencies and function details
dora fn src/utils/validation.ts

# 2. Check for code smells before refactoring
dora smells src/utils/validation.ts

# 3. If file contains classes, understand the hierarchy
dora class src/services/UserService.ts

# 4. View dependencies to assess impact
dora rdeps src/utils/validation.ts --depth 2
```

## Interpreting Cyclomatic Complexity Scores

Cyclomatic complexity measures the number of linearly independent paths through a function.

| Score | Interpretation | Action |
|-------|----------------|--------|
| 1-5 | Simple, low risk | Safe to modify |
| 6-10 | Moderate complexity | Review before changes |
| 11-20 | High complexity | Refactor candidate |
| 21+ | Very high complexity | Prioritize refactoring |

**Example:**
```bash
dora fn src/handlers/OrderProcessor.ts --sort complexity --limit 5
```

**Output interpretation:**
- Functions with complexity > 10 warrant extra caution
- Multiple high-complexity functions in one file signal a maintenance burden
- Combine with `reference_count` to prioritize: high complexity + high references = critical to fix

## Pre-Refactor Checklist with `dora smells`

Run this checklist before any significant refactoring:

```bash
dora smells src/components/CheckoutForm.ts
```

**Checks performed:**
1. High cyclomatic complexity (threshold: 10)
2. Long functions (threshold: 100 lines)
3. Excessive parameters (threshold: 5)
4. TODO/FIXME/HACK comments

**Interpretation:**
- Clean output: Safe to proceed with changes
- Any smells: Address them before or during refactoring
- High complexity + long function: Break into smaller functions
- Too many params: Consider parameter object pattern

**Custom thresholds:**
```bash
dora smells src/api/handlers.ts --complexity-threshold 15 --loc-threshold 80
```

## Navigating Inheritance with `dora class`

Use `dora class` to understand class hierarchies before modifying class-based code:

```bash
# List all classes in a file with method counts
dora class src/services/BaseService.ts

# Find classes with the most methods
dora class src/models/ --sort methods
```

**Output includes:**
- Class name and location (start/end lines)
- Parent class (`extends_name`)
- Implemented interfaces (`implements`)
- Method signatures with async flags
- Property counts
- Reference counts from SCIP correlation

**Workflow for inheritance changes:**
1. Run `dora class` on the target file
2. Note the `extends_name` and `implements` arrays
3. Check parent classes with `dora symbol <ParentClass>`
4. Use `dora rdeps` to find all files that extend the class

## Grammar Installation

Tree-sitter requires language-specific grammars (WASM files).

### Supported Languages

| Language | Package | Extensions |
|----------|---------|------------|
| TypeScript | `tree-sitter-typescript` | .ts |
| TSX | `tree-sitter-tsx` | .tsx |
| JavaScript | `tree-sitter-javascript` | .js, .mjs, .cjs |
| JSX | `tree-sitter-javascript` | .jsx |

### Installation

Install grammars as project dependencies:

```bash
bun add tree-sitter-typescript tree-sitter-tsx tree-sitter-javascript
```

Or install globally:

```bash
bun add -g tree-sitter-typescript tree-sitter-tsx tree-sitter-javascript
```

### Custom Grammar Paths

Configure explicit paths in `.dora/config.json`:

```json
{
  "treeSitter": {
    "grammars": {
      "typescript": "/custom/path/tree-sitter-typescript.wasm"
    }
  }
}
```

## SCIP vs Tree-Sitter: Complementary Data

| Aspect | SCIP | Tree-Sitter |
|--------|------|-------------|
| **Scope** | Cross-file relationships | Single-file structure |
| **Data** | Symbol references, dependencies | AST-based complexity, class hierarchies |
| **Speed** | Database queries (fast) | Parse on demand (slower) |
| **Use for** | Impact analysis, finding definitions | Refactoring prep, complexity analysis |

**Combined workflow example:**

```bash
# 1. Find where a function is used (SCIP)
dora refs validateEmail

# 2. Analyze its complexity before changing (Tree-sitter)
dora fn src/utils/validation.ts | jq '.functions[] | select(.name == "validateEmail")'

# 3. Check for smells in the file
dora smells src/utils/validation.ts

# 4. Assess impact on dependents
dora rdeps src/utils/validation.ts --depth 2
```

**Correlation:** `dora fn` and `dora class` automatically correlate with SCIP data when available, adding `reference_count` to each function/class showing how many times it is referenced across the codebase.
