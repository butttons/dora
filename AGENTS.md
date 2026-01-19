# dora - Code Context for AI Agents

dora is a language-agnostic CLI that helps AI agents understand codebases by querying SCIP indexes stored in SQLite. It provides fast, structured queries for symbols, dependencies, and architecture analysis.

## Quick Start

```bash
# Install dora (add to PATH)
# See README.md for installation instructions

# Initialize and index
dora init
dora index

# Query the codebase
dora status              # Check index health
dora map                 # Show packages and stats
dora symbol <query>      # Find symbols
dora file <path>         # Analyze file with dependencies
dora deps <path>         # Show dependencies
dora rdeps <path>        # Show reverse dependencies
```

---

## Claude Code Integration

dora integrates deeply with Claude Code via skills, hooks, and pre-approved permissions.

### Setup

1. **Configure settings:**

   Create `.claude/settings.json`:

   ```json
   {
     "permissions": {
       "allow": ["Bash(dora:*)", "Skill(dora)"]
     },
     "hooks": {
       "SessionStart": [
         {
           "hooks": [
             {
               "type": "command",
               "command": "dora status 2>/dev/null && (dora index > /tmp/dora-index.log 2>&1 &) || echo 'dora not initialized. Run: dora init && dora index'"
             }
           ]
         }
       ],
       "Stop": [
         {
           "hooks": [
             {
               "type": "command",
               "command": "(dora index > /tmp/dora-index.log 2>&1 &) || true"
             }
           ]
         }
       ]
     }
   }
   ```

   This enables:
   - **Auto-indexing**: Runs `dora index` in background after each turn
   - **Pre-approved permissions**: dora commands don't require permission prompts
   - **Automatic usage**: Claude prefers dora over Grep/Glob for code exploration

2. **Add dora skill (optional, enables `/dora` command):**

   After running `dora init`, create a symlink:

   ```bash
   mkdir -p .claude/skills/dora
   ln -s ../../../.dora/docs/SKILL.md .claude/skills/dora/SKILL.md
   ```

3. **Add to CLAUDE.md:**

   After running `dora init`, add the command reference:

   ```bash
   cat .dora/docs/SNIPPET.md >> CLAUDE.md
   ```

   This gives Claude quick access to dora commands and guidance on when to use dora for code exploration.

4. **Initialize dora:**

   ```bash
   dora init
   dora index
   ```

### Claude Code Usage

Once configured, Claude will automatically:

- Use `dora file` to understand files and their dependencies
- Use `dora symbol` to find definitions across the codebase
- Use `dora deps`/`dora rdeps` to trace relationships
- Use `dora cycles` to detect architectural issues

**Manual skill invocation:** Type `/dora` for quick reference of all commands.

---

## OpenCode Integration

OpenCode's agent system allows deep integration with dora for code exploration and analysis.

### Setup

1. **Configure global settings:**

   Create or edit `~/.config/opencode/opencode.json`:

   ```json
   {
     "$schema": "https://opencode.ai/config.json",
     "permission": {
       "bash": {
         "dora *": "allow"
       }
     }
   }
   ```

   This pre-approves all dora commands so agents can use them without permission prompts.

2. **Create dora agent (optional):**

   Create `~/.config/opencode/agents/dora.md`:

   ```markdown
   ---
   description: Fast code exploration using dora CLI
   mode: subagent
   tools:
     write: false
     edit: false
   permission:
     bash:
       "dora *": "allow"
   ---

   You are a code exploration specialist using the dora CLI.

   Always start by checking index status:
   - Run `dora status` to verify index is available

   For code exploration, use:
   - `dora file <path>` - Understand files and their dependencies
   - `dora symbol <query>` - Find symbol definitions
   - `dora deps <path>` - Show what a file imports
   - `dora rdeps <path>` - Show what imports a file
   - `dora adventure <from> <to>` - Find path between files

   For architecture analysis:
   - `dora cycles` - Find circular dependencies
   - `dora coupling` - Find tightly coupled files
   - `dora complexity` - Identify high-impact files
   - `dora treasure` - Find most referenced files

   Never modify code - focus on analysis and exploration.
   ```

   This creates a `@dora` subagent optimized for code exploration.

3. **Add project-specific config (optional):**

   Create `.opencode/opencode.json` in your project:

   ```json
   {
     "$schema": "https://opencode.ai/config.json",
     "agent": {
       "build": {
         "permission": {
           "bash": {
             "dora *": "allow"
           }
         }
       }
     }
   }
   ```

4. **Initialize dora:**

   ```bash
   dora init
   dora index
   ```

### OpenCode Usage

**Using the @dora subagent:**

```
@dora find the AuthService class and show me its dependencies
@dora what files would be impacted if I change src/types.ts?
@dora are there any circular dependencies in the codebase?
```

**With primary agents (Build/Plan):**

The Build agent can automatically use dora commands when exploring code:

```
show me how the billing module is structured
what files depend on the authentication system?
find all references to the Logger interface
```

**In custom agents:**

Create task-specific agents that leverage dora:

`~/.config/opencode/agents/refactor-analyzer.md`:

```markdown
---
description: Analyzes code for refactoring opportunities
mode: subagent
permission:
  bash:
    "dora *": "allow"
  edit: deny
---

Before suggesting refactorings:
1. Run `dora file <path>` to understand dependencies
2. Run `dora rdeps <path>` to check impact
3. Run `dora coupling` to find tightly coupled code
4. Run `dora complexity` to prioritize high-impact files

Focus on architectural improvements backed by data.
```

### Auto-indexing

Add dora indexing to your workflow by creating a task agent:

`~/.config/opencode/agents/indexer.md`:

```markdown
---
description: Keeps dora index up-to-date
mode: subagent
hidden: true
permission:
  bash:
    "dora index*": "allow"
---

Run `dora index` in the background after file changes.
```

Invoke it from your Build agent when needed, or add to your project's watch scripts.

---

## Cursor Integration

Cursor can use dora as a CLI tool via terminal commands or indexed codebase context.

### Setup

1. **Install dora** and ensure it's in PATH:

   ```bash
   which dora  # Should return path
   ```

2. **Add to Cursor Rules** (`.cursorrules` or Settings > Cursor Settings):

   ```
   # Code Exploration
   - Use `dora` CLI for code exploration instead of grep/find
   - Run `dora status` to check if index is available
   - Use `dora file <path>` to understand files
   - Use `dora symbol <query>` to find definitions
   - Use `dora deps` and `dora rdeps` to trace dependencies

   # Common Commands
   - dora map - Show codebase overview
   - dora symbol <name> - Find symbol definitions
   - dora file <path> - Analyze file with dependencies
   - dora cycles - Find circular dependencies
   - dora treasure - Find most referenced files
   ```

3. **Create custom commands (recommended):**

   Create `.cursor/commands/` directory in your project and add dora command files:

   `.cursor/commands/dora-explore.md`:
   ```markdown
   Use dora CLI to explore the codebase structure.

   Steps:
   1. Run `dora status` to check index health
   2. Run `dora map` to show packages and statistics
   3. Run `dora treasure` to identify core files
   4. Analyze the results and provide insights
   ```

   `.cursor/commands/dora-analyze-file.md`:
   ```markdown
   Analyze a file and its dependencies using dora.

   For the file path provided in the parameters:
   1. Run `dora file <path>` to see symbols and dependencies
   2. Run `dora rdeps <path>` to see what depends on this file
   3. Explain the file's role in the codebase
   ```

   `.cursor/commands/dora-find-symbol.md`:
   ```markdown
   Find a symbol definition using dora.

   For the symbol name provided:
   1. Run `dora symbol <name>` to find the definition
   2. If found, run `dora file <path>` on the containing file
   3. Show the symbol location and context
   ```

   `.cursor/commands/dora-check-architecture.md`:
   ```markdown
   Check codebase architecture for issues using dora.

   1. Run `dora cycles` to find circular dependencies
   2. Run `dora coupling --threshold 5` to find tightly coupled files
   3. Run `dora complexity --sort complexity` to identify high-risk files
   4. Summarize findings and suggest improvements
   ```

   These commands appear when you type `/` in Cursor chat.

4. **Index your codebase:**
   ```bash
   dora init
   dora index
   ```

### Cursor Usage

**Using custom commands:**

```
/dora-explore
/dora-analyze-file src/app.ts
/dora-find-symbol AuthService
/dora-check-architecture
```

**Direct chat:**

- **In chat:** "Use dora to find the AuthService definition"
- **In composer:** "Run dora deps on src/app.ts and explain the dependency tree"

**Auto-indexing:** Add `dora index` to your build/watch scripts

### Team Commands (Team/Enterprise)

For organizations, create team-wide dora commands in the Cursor Dashboard:

1. Navigate to Team Content → Commands
2. Create commands like "Analyze with dora", "Check architecture", etc.
3. All team members get instant access via `/` commands

This ensures consistent codebase exploration workflows across your team.

---

## Windsurf Integration

Windsurf's Cascade agent supports Skills, AGENTS.md files, and Rules for deep dora integration.

### Setup

1. **Install dora** and ensure it's in PATH:

   ```bash
   which dora  # Should return path
   dora --version
   ```

2. **Create a dora Skill (recommended):**

   After running `dora init`, copy the generated skill file:

   ```bash
   mkdir -p .windsurf/skills/dora
   cp .dora/docs/SKILL.md .windsurf/skills/dora/SKILL.md
   ```

   Or create a symlink to always use the latest version:

   ```bash
   mkdir -p .windsurf/skills/dora
   ln -s ../../../.dora/docs/SKILL.md .windsurf/skills/dora/SKILL.md
   ```

   You can now invoke the skill with `@dora` in Cascade chat. [View the skill template](https://github.com/butttons/dora/blob/main/src/templates/docs/SKILL.md).

3. **Add AGENTS.md snippet (recommended):**

   After running `dora init`, add dora context to your project's AGENTS.md:

   ```bash
   cat .dora/docs/SNIPPET.md >> AGENTS.md
   ```

   This gives Cascade automatic access to dora commands when working in your project. You can also place the snippet in directory-specific `AGENTS.md` files for scoped instructions. [View the snippet template](https://github.com/butttons/dora/blob/main/src/templates/docs/SNIPPET.md).

4. **Add to Windsurf Rules (optional):**

   Create `.windsurf/rules/dora.md`:

   ```markdown
   ---
   description: Code exploration with dora CLI
   trigger: glob
   globs: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx']
   ---

   When exploring code:
   - Run `dora status` first to check index availability
   - Use `dora file <path>` to understand files
   - Use `dora symbol <query>` to find definitions
   - Use `dora deps`/`dora rdeps` to trace relationships
   - Run `dora cycles` periodically to check architecture
   ```

5. **Initialize dora:**
   ```bash
   dora init
   dora index
   ```

### Windsurf Usage

**Using the @dora skill:**

```
@dora explore the authentication module
@dora find all references to UserContext
@dora check for circular dependencies
```

**With AGENTS.md:**

When `AGENTS.md` contains dora instructions, Cascade automatically knows to use dora commands when exploring your codebase. Just ask naturally:

```
show me how the billing module is structured
what would be impacted if I change src/types.ts?
find the Logger interface definition
```

**With directory-scoped AGENTS.md:**

Place `AGENTS.md` files in specific directories to provide targeted guidance:

```
src/components/AGENTS.md    # Instructions for component exploration
src/api/AGENTS.md           # Instructions for API exploration
```

Cascade automatically uses the appropriate instructions based on which files you're working with.

**Direct commands:**

```
run dora file src/app.ts and explain the dependencies
use dora to check for circular dependencies
run dora complexity to find high-risk files
```

---

## Generic AI Agent Integration

For AI agents and IDEs not listed above, dora provides standard integration files you can adapt.

### Setup

1. **Install dora** and ensure it's in PATH:

   ```bash
   which dora  # Should return path
   dora --version
   ```

2. **Add command reference to agent memory:**

   After running `dora init`, use the generated snippet for your AI agent's memory/context file:

   ```bash
   cat .dora/docs/SNIPPET.md >> <your-agent-memory-file>
   ```

   Examples:
   - For agents with custom instructions: Copy to instructions file
   - For agents with context files: Append to context file
   - For agents with .cursorrules-like files: Add to rules file

   This snippet includes:
   - Command reference for all dora commands
   - When to use dora vs other tools
   - Best practices for code exploration

3. **Reference the skill document:**

   The generated `.dora/docs/SKILL.md` file contains detailed command usage:

   ```bash
   cat .dora/docs/SKILL.md
   ```

   Use this as a reference for:
   - Creating agent-specific skills/commands
   - Understanding dora workflows
   - Command examples and patterns

4. **Setup auto-indexing hooks (if supported):**

   If your AI agent supports hooks or lifecycle scripts, configure:

   **Session start hook:**
   ```bash
   # Check if initialized, run index in background
   dora status 2>/dev/null && (dora index > /tmp/dora-index.log 2>&1 &) || echo 'Run: dora init && dora index'
   ```

   **End of turn hook (after file changes):**
   ```bash
   # Run index in background, never fail
   (dora index > /tmp/dora-index.log 2>&1 &) || true
   ```

   This keeps the index up-to-date automatically as you work.

5. **Initialize dora:**
   ```bash
   dora init
   dora index
   ```

### Usage Patterns

**For terminal-based agents:**

```bash
# Explore before making changes
dora file src/app.ts
dora rdeps src/types.ts

# Make changes
# ... agent makes file edits ...

# Refresh index
dora index
```

**For chat-based agents:**

Configure the agent to use dora commands when:
- Exploring code: `dora file`, `dora symbol`, `dora deps`
- Understanding architecture: `dora map`, `dora treasure`, `dora cycles`
- Checking impact: `dora rdeps`, `dora coupling`
- Finding code: `dora symbol`, `dora refs`

**For workflow-based agents:**

Create workflows that use dora for:
1. Pre-task analysis (understand dependencies)
2. Impact checking (what will be affected)
3. Post-task validation (check for cycles, complexity)

### Integration Files Reference

After `dora init`, you'll find these files in `.dora/docs/`:

- **`SNIPPET.md`** - Short command reference for agent memory/context
- **`SKILL.md`** - Complete skill document with workflows and examples

Use these as templates to create agent-specific configurations.

---

## Tech Stack

- **Runtime:** Bun
- **Database:** SQLite (bun:sqlite)
- **Language:** TypeScript
- **Index Format:** SCIP (Source Code Intelligence Protocol)
- **Binary:** Standalone executable (macOS, Linux, Windows)

## SCIP Indexer Required

dora requires a SCIP indexer for your language:

- **TypeScript/JavaScript:** `scip-typescript` ([install](https://github.com/sourcegraph/scip-typescript))
- **Rust:** `rust-analyzer scip`
- **Java:** `scip-java`
- **Python:** `scip-python`
- **Go:** `scip-go`

See [SCIP indexers](https://github.com/sourcegraph/scip?tab=readme-ov-file#tools-using-scip) for full list.

## Common Commands

### Overview

```bash
dora status              # Check index health
dora map                 # Show packages, file count, symbol count
```

### Code Navigation

```bash
dora ls [directory]      # List files with metadata
dora file <path>         # Analyze file with dependencies
dora symbol <query>      # Find symbols by name
dora refs <symbol>       # Find all references
dora deps <path>         # Show dependencies (what this imports)
dora rdeps <path>        # Show dependents (what imports this)
dora adventure <a> <b>   # Find shortest path between files
```

### Architecture Analysis

```bash
dora cycles              # Find circular dependencies
dora coupling            # Find tightly coupled files
dora complexity          # Show complexity metrics
dora treasure            # Most referenced files
dora lost                # Find unused symbols
dora leaves              # Find leaf nodes
```

### Advanced

```bash
dora schema              # Show database schema
dora query "<sql>"       # Execute raw SQL (read-only)
dora changes <ref>       # Git impact analysis
```

## Output Format

All commands output **valid JSON** to stdout:

```bash
dora file src/app.ts | jq '.depends_on'
dora symbol Logger | jq '.results[].path'
```

Errors go to stderr with exit code 1.

## Rules & Boundaries

### Do This

- **Always check index first:** `dora status`
- **Use dora for code exploration** instead of grep/find/glob when possible
- **Check dependencies before changes:** `dora rdeps <path>`
- **Validate architecture:** Run `dora cycles` periodically
- **Pipe to jq** for filtering JSON output

### Never Do This

- **Don't modify .dora/ directory** - it's auto-generated
- **Don't commit .dora/dora.db** - add to .gitignore
- **Don't run dora on non-indexed repos** - run `dora init` first
- **Don't parse source code** - dora provides structured data instead

### Performance Tips

- Use `--depth 1` for faster dependency queries
- Use `--limit` to cap large result sets
- Run `dora index` in background (Claude Code does this automatically)
- Index incrementally - dora only reindexes changed files

## Troubleshooting

### Index Issues

```bash
dora status              # Check index health
dora index --full        # Force full rebuild
DEBUG=dora:* dora index  # Show debug logs
```

### Command Not Found

```bash
which dora               # Check PATH
echo $PATH               # Verify dora directory in PATH
```

### Stale Results

```bash
dora index               # Refresh index
dora status              # Verify lastIndexed timestamp
```

## Links

- **GitHub:** https://github.com/butttons/dora
- **Documentation:** See README.md and CLAUDE.md
- **SCIP Protocol:** https://github.com/sourcegraph/scip
