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

3. **Index your codebase:**
   ```bash
   dora init
   dora index
   ```

### Cursor Usage

- **In chat:** Ask Cursor to "use dora to find the AuthService definition"
- **In composer:** "Run dora deps on src/app.ts and explain the dependency tree"
- **Auto-indexing:** Add `dora index` to your build/watch scripts

---

## Aider Integration

Aider is a CLI pair programmer that works in your terminal with git integration.

### Setup

1. **Install dora and aider:**

   ```bash
   # Install dora (see README.md)
   # Install aider
   pip install aider-chat
   ```

2. **Create `.aider.conf.yml` in your project:**

   ```yaml
   # Suggest using dora for code exploration
   edit-format: diff
   map-tokens: 2048
   ```

3. **Index your codebase:**
   ```bash
   dora init
   dora index
   ```

### Aider Usage

Start aider and give it context using dora:

```bash
# Start aider
aider

# In aider chat, ask it to use dora
> Before making changes, run `dora file src/app.ts` to see dependencies
> Use `dora symbol AuthService` to find where it's defined
> Run `dora rdeps src/types.ts` to see what depends on this file
```

**Pro tip:** Create shell aliases for common workflows:

```bash
alias aider-explore="dora map && dora treasure && aider"
```

---

## Cline / Continue Integration

Cline (VSCode) and Continue (VSCode/JetBrains) can execute CLI tools and use MCP servers.

### Setup for Both

1. **Install dora** and ensure it's in PATH

2. **Index your codebase:**
   ```bash
   dora init
   dora index
   ```

### Cline-Specific Setup

1. **Configure in VSCode settings** (`settings.json`):

   ```json
   {
     "cline.terminalShell": "/bin/bash",
     "cline.allowedCommands": ["dora"]
   }
   ```

2. **Add to Cline custom instructions:**
   ```
   When exploring code:
   - Use `dora file <path>` to understand files
   - Use `dora symbol <query>` to find definitions
   - Use `dora deps` and `dora rdeps` to trace dependencies
   - Use `dora cycles` to check for circular dependencies
   ```

### Continue-Specific Setup

1. **Configure in `.continue/config.json`:**
   ```json
   {
     "customCommands": [
       {
         "name": "dora-explore",
         "description": "Explore codebase with dora",
         "prompt": "Use dora CLI to explore: dora map, dora file {filepath}, dora symbol {selection}"
       }
     ]
   }
   ```

### Usage

- **Ask to run commands:** "Run dora file src/app.ts and explain the dependencies"
- **Context gathering:** "Use dora to find all references to UserContext"
- **Architecture analysis:** "Run dora cycles to check for circular dependencies"

---

## Windsurf Integration

Windsurf's Cascade agent can execute terminal commands and maintain context.

### Setup

1. **Install dora** and ensure it's in PATH

2. **Add to Windsurf Rules** (Settings > Cascade > Custom Instructions):

   ```
   # Code Exploration with dora
   - Use `dora` CLI for fast code intelligence
   - Run `dora status` first to check index availability
   - Use `dora file <path>` to understand files and their dependencies
   - Use `dora symbol <query>` to find definitions across codebase
   - Use `dora deps`/`dora rdeps` to trace relationships

   # Architecture Analysis
   - Run `dora cycles` to detect circular dependencies
   - Run `dora complexity` to find high-impact files
   - Run `dora treasure` to find core/hub files
   ```

3. **Index your codebase:**
   ```bash
   dora init
   dora index
   ```

### Usage

Cascade can autonomously:

- Run `dora file` before editing files to understand dependencies
- Use `dora rdeps` to check impact before changes
- Run `dora cycles` to validate architecture
- Execute `dora index` to refresh after changes

---

## Other AI Agents / IDEs

### Generic Integration

Any AI agent with terminal access can use dora:

1. **Ensure dora is in PATH:**

   ```bash
   which dora  # Should return path
   dora --version
   ```

2. **Add to agent's system prompt/instructions:**

   ```
   Use dora CLI for code exploration:
   - dora status - Check index health
   - dora file <path> - Analyze file with dependencies
   - dora symbol <query> - Find symbols
   - dora deps/rdeps <path> - Show dependencies
   - dora cycles - Find circular dependencies
   ```

3. **Index your codebase:**
   ```bash
   dora init
   dora index
   ```

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
