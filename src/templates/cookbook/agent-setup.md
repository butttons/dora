# Agent Setup: Configuring dora for AI Agents

Step-by-step guide for setting up dora hooks, extensions, and skills in any AI agent or editor.

---

## Prerequisites

```bash
# dora must be installed and in PATH
which dora

# Initialize and index the project
dora init
dora index

# Verify it works
dora status
```

---

## Claude Code

### Settings (.claude/settings.json)

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

### Skill (optional)

```bash
mkdir -p .claude/skills/dora
ln -s ../../../.dora/docs/SKILL.md .claude/skills/dora/SKILL.md
```

### Context snippet

```bash
cat .dora/docs/SNIPPET.md >> CLAUDE.md
```

---

## pi

pi auto-loads project-local extensions from `.pi/extensions/`.

### Extensions

Copy the dora extensions into your project:

```bash
mkdir -p .pi/extensions
```

**`.pi/extensions/dora.ts`** — Lifecycle hooks (session start check, background index on shutdown):

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  let doraAvailable = false;

  pi.on("session_start", async (_event, ctx) => {
    try {
      const check = await pi.exec("bash", ["-c", "command -v dora"], { timeout: 1000 });
      doraAvailable = check.code === 0;
      if (doraAvailable) {
        const status = await pi.exec("bash", ["-c", "dora status 2>/dev/null"], { timeout: 2000 });
        if (status.code !== 0) {
          ctx.ui.notify("dora not initialized. Run: dora init && dora index", "info");
        }
      }
    } catch (error) {
      doraAvailable = false;
    }
  });

  pi.on("session_shutdown", async (_event, _ctx) => {
    if (doraAvailable) {
      pi.exec("bash", ["-c", "(dora index > /tmp/dora-index.log 2>&1 &) || true"], {
        timeout: 500,
      }).catch(() => {});
    }
  });
}
```

### Skill (optional)

```bash
mkdir -p .pi/skills/dora
ln -s ../../../.dora/docs/SKILL.md .pi/skills/dora/SKILL.md
```

---

## OpenCode

### Global config (~/.config/opencode/opencode.json)

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

### Optional: dora subagent (~/.config/opencode/agents/dora.md)

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
Use dora commands for symbol search, dependency analysis, and architecture review.
Never modify code - focus on analysis and exploration.
```

---

## Cursor

### Rules (.cursorrules)

```
# Code Exploration
- Use `dora` CLI for code exploration instead of grep/find
- Run `dora status` to check if index is available
- Use `dora file <path>` to understand files
- Use `dora symbol <query>` to find definitions
- Use `dora deps` and `dora rdeps` to trace dependencies
```

### Custom commands (.cursor/commands/)

Create `.cursor/commands/dora-explore.md`:

```markdown
Use dora CLI to explore the codebase structure.

1. Run `dora status` to check index health
2. Run `dora map` to show packages and statistics
3. Run `dora treasure` to identify core files
4. Analyze the results and provide insights
```

---

## Windsurf

### Skill

```bash
mkdir -p .windsurf/skills/dora
cp .dora/docs/SKILL.md .windsurf/skills/dora/SKILL.md
```

### Context snippet

```bash
cat .dora/docs/SNIPPET.md >> AGENTS.md
```

### Rules (optional, .windsurf/rules/dora.md)

```markdown
---
description: Code exploration with dora CLI
trigger: glob
globs: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]
---

When exploring code, use dora CLI commands first:
- `dora file <path>` to understand files
- `dora symbol <query>` to find definitions
- `dora deps`/`dora rdeps` to trace relationships
```

---

## Generic / Other Agents

For any agent that supports context files or system prompts:

1. **Add command reference to agent context:**

```bash
cat .dora/docs/SNIPPET.md >> <your-agent-context-file>
```

2. **Set up auto-indexing hooks (if supported):**

Session start:
```bash
dora status 2>/dev/null && (dora index > /tmp/dora-index.log 2>&1 &) || echo 'Run: dora init && dora index'
```

After file changes:
```bash
(dora index > /tmp/dora-index.log 2>&1 &) || true
```

---

## MCP Server (works with any MCP client)

```bash
# Start MCP server
dora mcp
```

### Claude Code

```bash
claude mcp add --transport stdio dora -- dora mcp
```

### Other MCP clients

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "dora": {
      "type": "stdio",
      "command": "dora",
      "args": ["mcp"]
    }
  }
}
```

---

## Verification

After setup, verify everything works:

```bash
dora status          # Index exists and is healthy
dora map             # Shows packages and file count
dora symbol main     # Can find symbols
dora treasure        # Can query architecture
```
