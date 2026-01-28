# Dora MCP Server

Dora is now available as an MCP (Model Context Protocol) server, allowing AI assistants like Claude to query your codebase directly.

## Installation

### Local Development

```bash
cd /path/to/dora
bun install
```

## Running the MCP Server

Start the MCP server using the `mcp` subcommand:

```bash
dora mcp
```

This starts the server and listens on stdin/stdout for MCP protocol messages.

## Configuration

### Claude Code (CLI)

**Recommended:** Add dora as an MCP server using the command line:

```bash
# Add dora globally (available across all projects)
claude mcp add --transport stdio --scope user dora -- dora mcp

# Or add it to the current project only
claude mcp add --transport stdio dora -- dora mcp
```

Verify the installation:

```bash
# List all configured MCP servers
claude mcp list

# Check dora specifically
claude mcp get dora

# Within Claude Code session, check status
/mcp
```

Now you can use dora in Claude Code:

```
> "Show me the dora index status"
> "Find symbols matching 'useState'"
> "What files depend on src/utils.ts?"
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "dora": {
      "command": "dora",
      "args": ["mcp"]
    }
  }
}
```

For local development (before installing):

```json
{
  "mcpServers": {
    "dora": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/dora/src/index.ts", "mcp"]
    }
  }
}
```

### Cline (VS Code Extension)

Add to VS Code settings (`settings.json`):

```json
{
  "cline.mcpServers": {
    "dora": {
      "command": "dora",
      "args": ["mcp"]
    }
  }
}
```

## Available Tools

The MCP server exposes all 29 dora commands as tools:

### Status & Overview

- `dora_init` - Initialize dora in repository
- `dora_index` - Run SCIP indexing
- `dora_status` - Show index status
- `dora_map` - High-level codebase overview

### File Analysis

- `dora_ls` - List files in directory
- `dora_file` - Analyze specific file
- `dora_symbol` - Search symbols
- `dora_refs` - Find symbol references

### Dependencies

- `dora_deps` - File dependencies
- `dora_rdeps` - Reverse dependencies
- `dora_adventure` - Path between files
- `dora_imports` - File imports
- `dora_exports` - Exported symbols

### Architecture Analysis

- `dora_cycles` - Bidirectional dependencies
- `dora_coupling` - Tightly coupled files
- `dora_complexity` - File complexity metrics
- `dora_leaves` - Leaf nodes
- `dora_treasure` - Most referenced files

### Documentation

- `dora_docs_list` - List documentation
- `dora_docs_search` - Search docs
- `dora_docs_show` - Show doc metadata

### Advanced

- `dora_schema` - Database schema
- `dora_query` - Raw SQL queries
- `dora_cookbook_list` - Query recipes
- `dora_cookbook_show` - Show recipe
- `dora_changes` - Changed files
- `dora_graph` - Dependency graph
- `dora_lost` - Unused symbols

## Usage Examples

Once configured, you can ask Claude:

```
"Show me the status of the dora index"
→ Calls dora_status

"Find all symbols matching 'Logger'"
→ Calls dora_symbol with query="Logger"

"What are the dependencies of src/index.ts?"
→ Calls dora_deps with path="src/index.ts"

"Find bidirectional dependencies"
→ Calls dora_cycles

"Show me files that depend on src/types.ts"
→ Calls dora_rdeps with path="src/types.ts"
```

## Architecture

The MCP server is implemented in `src/mcp.ts` and uses:

- **@modelcontextprotocol/sdk** - MCP protocol implementation
- **Zod** - Runtime type validation (schemas in `src/schemas/`)
- **ts-pattern** - Type-safe pattern matching (routing in `src/mcp/handlers.ts`)

### Key Files

- `src/mcp.ts` - MCP server entry point
- `src/mcp/metadata.ts` - Tool definitions (29 commands)
- `src/mcp/inputSchemas.ts` - Zod schema generator
- `src/mcp/handlers.ts` - Tool call routing
- `src/mcp/captureOutput.ts` - stdout capture utility
- `src/schemas/` - Zod schemas for all result types

## Logging

The MCP server logs to stderr. To see logs:

```bash
# In Claude Desktop, check:
~/Library/Logs/Claude/mcp*.log

# For local development:
bun run src/mcp.ts 2>mcp-debug.log
```

## Troubleshooting

### Server not starting

Check that dora is initialized in your project:

```bash
cd /path/to/project
dora init
dora index
```

### Tools not appearing

1. Restart Claude Desktop
2. Check logs in `~/Library/Logs/Claude/`
3. Verify configuration path is absolute

### Permission errors

Ensure the binary is executable:

```bash
chmod +x $(which dora-mcp)
```

## CLI vs MCP

Both interfaces are fully functional:

- **CLI (`dora`)** - Direct terminal use, human-readable output
- **MCP (`dora-mcp`)** - AI assistant integration, structured JSON responses

All 29 commands work identically in both modes.
