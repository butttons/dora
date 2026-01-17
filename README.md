# dora - Code Context CLI for AI Agents

A language-agnostic CLI tool that helps AI agents understand large codebases by querying SCIP (Source Code Intelligence Protocol) indexes stored in SQLite.

## Features

- **Language-Agnostic SCIP Support** - Works with any SCIP-compatible indexer (TypeScript, Java, Rust, Python, etc.)
- **Blazing Fast Performance** - 10-50x faster queries with denormalized database optimization
- **Architecture Analysis** - Detect circular dependencies, coupling, and complexity hotspots
- **Dependency Intelligence** - Track dependencies at any depth with symbol-level granularity
- **AI-Optimized JSON Output** - Clean, structured data designed for AI agent consumption
- **Incremental Indexing** - Only reindexes changed files for fast updates

## System Requirements

- **Binary users**: No dependencies - standalone executable
- **From source**: Bun 1.0+ required
- **SCIP indexer**: Language-specific (e.g., scip-typescript for TS/JS)
- **Supported OS**: macOS, Linux, Windows
- **Disk space**: ~5-50MB for index (varies by codebase size)

## Claude Code Integration

dora integrates seamlessly with Claude Code for AI-powered code navigation.

**Quick Setup (3 minutes):**

1. **Add to your project's CLAUDE.md:**
   - Copy the contents of [`.dora/docs/SNIPPET.md`](.dora/docs/SNIPPET.md) from this repo
   - Paste it into your project's CLAUDE.md file

2. **Add settings configuration:**
   - Copy [`.claude/settings.json`](.claude/settings.json) from this repo to your project
   - This enables automatic indexing and permissions

3. **Initialize dora:**
   ```bash
   dora init
   dora index
   ```

That's it! Claude Code now uses dora for all code exploration.

**What's Included:**

- **Checkpoint-based indexing** - Runs `dora index` automatically in background when Claude finishes each turn
- **Auto-approved permissions** - All dora query commands pre-approved (no prompts during workflow)
- **Automatic steering** - Claude prefers dora over Grep/Glob for code exploration

**Configuration Files:**

- `.dora/docs/SNIPPET.md` - Documentation to paste into your CLAUDE.md
- `.claude/settings.json` - Example settings with hooks and permissions

**Troubleshooting:**

- **Index not updating?** Check `/tmp/dora-index.log` for errors
- **dora not found?** Ensure dora is in PATH: `which dora`
- **Stale results?** Run `dora index --full` to force full rebuild

## Installation

### Option 1: Download Pre-built Binary (Recommended)

Download the latest binary for your platform from the [releases page](https://github.com/butttons/dora/releases):

```bash
# macOS (ARM64)
curl -L https://github.com/butttons/dora/releases/latest/download/dora-darwin-arm64 -o dora
chmod +x dora
sudo mv dora /usr/local/bin/

# macOS (Intel)
curl -L https://github.com/butttons/dora/releases/latest/download/dora-darwin-x64 -o dora
chmod +x dora
sudo mv dora /usr/local/bin/

# Linux
curl -L https://github.com/butttons/dora/releases/latest/download/dora-linux-x64 -o dora
chmod +x dora
sudo mv dora /usr/local/bin/

# Windows
# Download dora-windows-x64.exe and add to PATH
```

### Option 2: Build from Source

```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Clone the repository
git clone https://github.com/butttons/dora.git
cd dora

# Install dependencies
bun install

# Build the binary
bun run build

# The binary will be at dist/dora
# Move it to your PATH
sudo mv dist/dora/usr/local/bin/
```

### Install SCIP Indexer

You'll need a SCIP indexer for your language. For TypeScript/JavaScript:

```bash
# Install scip-typescript globally
npm install -g @sourcegraph/scip-typescript

# Verify installation
scip-typescript --help
```

For other languages, see [SCIP Indexers](#scip-indexers).

## Quick Start

### 1. Initialize

```bash
dora init
```

This creates a `.dora/` directory with a default config.

### 2. Configure Commands

Edit `.dora/config.json` to configure your SCIP indexer:

**For TypeScript/JavaScript:**

```json
{
  "commands": {
    "index": "scip-typescript index --output .dora/index.scip"
  }
}
```

**For Rust:**

```json
{
  "commands": {
    "index": "rust-analyzer scip . --output .dora/index.scip"
  }
}
```

### 3. Index Your Codebase

```bash
# If commands are configured:
dora index

# Or manually:
scip-typescript index --output .dora/index.scip
```

### 4. Try It Out

```bash
# Check index status
dora status

# Get codebase overview
dora map

# Find a symbol
dora symbol Logger
```

### 5. Example Workflow

```bash
# Find a class definition
dora symbol AuthService

# Explore the file
dora file src/auth/service.ts

# See what depends on it
dora rdeps src/auth/service.ts --depth 2

# Check for circular dependencies
dora cycles
```

## Commands Overview

### Setup & Status

```bash
dora init                    # Initialize in repo
dora index                   # Index codebase (incremental)
dora index --full            # Force full reindex
dora status                  # Show index health
dora map                # High-level statistics
```

### Code Navigation

```bash
dora symbol <query>          # Find symbols by name
dora file <path>             # File info with dependencies
dora refs <symbol>           # Find all references
dora deps <path> --depth 2   # Show dependencies
dora rdeps <path> --depth 2  # Show dependents
dora adventure <from> <to>        # Find shortest path
```

### Architecture Analysis

```bash
dora cycles                  # Find bidirectional dependencies
dora coupling --threshold 5  # Find tightly coupled files
dora complexity --sort complexity  # High-impact files
dora treasure --limit 20     # Most referenced files
dora lost --limit 50       # Potentially dead code
dora leaves --max-dependents 3  # Leaf nodes
```

### Advanced Queries

```bash
dora schema                  # Show database schema
dora query "<sql>"           # Execute raw SQL (read-only)
dora changes <ref>           # Changed/impacted files
dora exports <path|package>  # List exports
dora imports <path>          # Show imports
dora graph <path>            # Dependency graph
```

## Command Reference

Quick reference for all commands with common flags:

### Setup Commands

| Command       | Description                      | Common Flags |
| ------------- | -------------------------------- | ------------ |
| `dora init`   | Initialize dora in repository    | -            |
| `dora index`  | Build/update index (incremental) | `--full`     |
| `dora status` | Check index status               | -            |
| `dora map`    | High-level statistics            | -            |

### Code Navigation

| Command                      | Description                    | Common Flags                 |
| ---------------------------- | ------------------------------ | ---------------------------- |
| `dora file <path>`           | Analyze file with dependencies | -                            |
| `dora symbol <query>`        | Search for symbols             | `--kind <type>`, `--limit N` |
| `dora refs <symbol>`         | Find all references            | -                            |
| `dora deps <path>`           | Show dependencies              | `--depth N` (default: 1)     |
| `dora rdeps <path>`          | Show reverse dependencies      | `--depth N` (default: 1)     |
| `dora adventure <from> <to>` | Find dependency path           | -                            |

### Architecture Analysis

| Command           | Description                     | Common Flags                 |
| ----------------- | ------------------------------- | ---------------------------- |
| `dora cycles`     | Find bidirectional dependencies | `--limit N` (default: 50)    |
| `dora coupling`   | Find tightly coupled files      | `--threshold N` (default: 5) |
| `dora complexity` | Show complexity metrics         | `--sort <metric>`            |
| `dora treasure`   | Most referenced files           | `--limit N` (default: 10)    |
| `dora lost`       | Find unused symbols             | `--limit N` (default: 50)    |
| `dora leaves`     | Find leaf nodes                 | `--max-dependents N`         |

### Advanced Commands

| Command                 | Description                 | Common Flags               |
| ----------------------- | --------------------------- | -------------------------- |
| `dora schema`           | Show database schema        | -                          |
| `dora query "<sql>"`    | Execute raw SQL (read-only) | -                          |
| `dora changes <ref>`    | Git impact analysis         | -                          |
| `dora exports <target>` | List exported symbols       | -                          |
| `dora imports <path>`   | Show file imports           | -                          |
| `dora graph <path>`     | Dependency graph            | `--depth N`, `--direction` |

## SCIP Indexers

- [scip-typescript](https://github.com/sourcegraph/scip-typescript): TypeScript, JavaScript
- [scip-java](https://github.com/sourcegraph/scip-java): Java, Scala, Kotlin
- [rust-analyzer](https://github.com/rust-lang/rust-analyzer): Rust
- [scip-clang](https://github.com/sourcegraph/scip-clang): C++, C
- [scip-ruby](https://github.com/sourcegraph/scip-ruby): Ruby
- [scip-python](https://github.com/sourcegraph/scip-python): Python
- [scip-dotnet](https://github.com/sourcegraph/scip-dotnet): C#, Visual Basic
- [scip-dart](https://github.com/Workiva/scip-dart): Dart
- [scip-php](https://github.com/davidrjenni/scip-php): PHP

## Output Format

All commands output valid JSON to stdout. Errors go to stderr with exit code 1.

## Debug Logging

For debug logging, testing, building, and development instructions, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Troubleshooting

### Common Issues

| Issue                      | Solution                                                     |
| -------------------------- | ------------------------------------------------------------ |
| **Database not found**     | Run `dora index` to create the database                      |
| **File not in index**      | Check if file is in .gitignore, run `dora index --full`      |
| **Stale results**          | Run `dora index --full` to force full rebuild                |
| **Slow queries**           | Use `--depth 1` when possible, reduce `--limit`              |
| **Symbol not found**       | Ensure index is up to date: `dora status`, then `dora index` |
| **dora command not found** | Ensure dora is in PATH: `which dora`, reinstall if needed    |

### Integration Issues

**Claude Code index not updating:**

- Check `/tmp/dora-index.log` for errors
- Verify dora is in PATH: `which dora`
- Test manually: `dora index`
- Ensure `dora index` is in the `allow` permissions list in `.claude/settings.json`

**Stop hook not firing:**

- Verify `.claude/settings.json` syntax is correct (valid JSON)
- Check that the hook runs by viewing verbose logs
- Try manually running the hook command

**Want to see indexing progress:**

- Edit `.claude/settings.json` Stop hook
- Change command to: `"DEBUG=dora:* dora index 2>&1 || true"` (removes background `&`)
- You'll see progress after each turn, but will wait 15-30s

### Performance Issues

**Index takes too long:**

- Use incremental indexing (default) - only reindexes changed files
- Run SCIP indexer separately with caching
- Use background indexing mode in Claude Code integration
- Check if your SCIP indexer can be optimized

**Queries are slow:**

- Use `--depth 1` instead of deep traversals
- Reduce `--limit` for large result sets
- Ensure database indexes are created (automatic)
- Run `dora index --full` if database is corrupted

## Contributing

Contributions are welcome! For development setup, testing, building binaries, and code style guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md).

Quick start:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests (`bun test`)
4. Submit a pull request

For detailed architecture and development guidelines, see [CLAUDE.md](./CLAUDE.md).

## License

MIT

## Links

- **GitHub**: [https://github.com/butttons/dora](https://github.com/butttons/dora)
- **SCIP Protocol**: [https://github.com/sourcegraph/scip](https://github.com/sourcegraph/scip)
- **Claude Code**: [https://claude.ai/code](https://claude.ai/code)
