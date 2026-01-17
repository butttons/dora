# Contributing to dora

Thank you for your interest in contributing to dora! This document provides guidelines and information for developers.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) 1.0+ (for development)
- A SCIP-compatible indexer for your language (e.g., scip-typescript for TypeScript/JavaScript)

### Development Setup

```bash
# Clone repository
git clone https://github.com/butttons/dora.git
cd dora

# Install dependencies
bun install

# Run CLI directly with Bun
bun src/index.ts <command>

# Run tests
bun test

# Build and test the binary
bun run build
./dist/dora --help

# Link for local development
bun link
```

For detailed architecture and development guidelines, see [CLAUDE.md](./CLAUDE.md).

## Building

Build standalone binaries for distribution:

```bash
# Build for your current platform
bun run build

# Build for specific platforms
bun run build:linux          # Linux x64
bun run build:macos          # macOS Intel
bun run build:macos-arm      # macOS ARM (M1/M2/M3)
bun run build:windows        # Windows x64

# Build for all platforms
bun run build:all

# Binaries will be in the dist/ directory
```

Binary sizes:

- **macOS/Linux**: ~57MB (includes Bun runtime)
- **Windows**: ~58MB (includes Bun runtime)

The binaries are completely standalone and don't require Bun or Node.js to be installed.

## Testing

The project includes comprehensive test coverage:

```bash
# Run all tests
bun test

# Run specific test files
bun test src/utils/paths.test.ts
bun test src/utils/config.test.ts
bun test src/db/queries.test.ts
bun test src/commands/commands.test.ts
bun test src/commands/index.test.ts
bun test src/converter/scip-parser.test.ts
```

Test coverage:

- **Unit Tests**: Path utilities, config management, error handling
- **Integration Tests**: Database queries with example database
- **Command Tests**: CLI commands and initialization
- **Parser Tests**: SCIP protobuf parsing and conversion
- **Index Tests**: Database schema and denormalized fields

## Debug Logging

The CLI uses the [`debug`](https://www.npmjs.com/package/debug) library for verbose logging during development and troubleshooting. Enable debug output using the `DEBUG` environment variable:

```bash
# Show all dora debug output
DEBUG=dora:* dora index

# Show only converter logs (useful for performance debugging)
DEBUG=dora:converter dora index

# Show only index command logs
DEBUG=dora:index dora index

# Show multiple namespaces
DEBUG=dora:index,dora:converter dora index
```

**Available namespaces:**

- `dora:index` - Index command progress and timing
- `dora:converter` - SCIP parsing and database conversion details
- `dora:db` - Database operations and queries
- `dora:config` - Configuration loading and validation

**Example output:**

```bash
$ DEBUG=dora:* dora index
  dora:index Loading configuration... +0ms
  dora:index Config loaded: root=/path/to/project +2ms
  dora:index Running SCIP indexer... +0ms
  dora:converter Parsing SCIP file... +28s
  dora:converter Parsed SCIP file: 412 documents +310ms
  dora:converter Converting 412 files to database... +0ms
  dora:converter Processing files: 412/412 (100%) +265ms
```

## Code Style

- Use TypeScript for all source code
- Follow existing code formatting (we use Bun's default formatter)
- Write descriptive variable and function names
- Add JSDoc comments for public APIs
- Keep functions focused and under 50 lines when possible

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes with tests
4. Run the test suite (`bun test`)
5. Build the binaries (`bun run build:all`)
6. Commit your changes (`git commit -am 'Add my feature'`)
7. Push to the branch (`git push origin feature/my-feature`)
8. Create a Pull Request

### PR Requirements

- All tests must pass
- New features should include tests
- Update documentation (README.md, CLAUDE.md) if needed
- Follow the existing code style
- Provide a clear description of the changes

## Architecture

dora is built around SCIP (Source Code Intelligence Protocol) indexes and SQLite for fast querying:

### Key Components

- **src/commands/** - CLI command implementations
- **src/converter/** - SCIP protobuf parser and SQLite converter
- **src/db/** - Database schema and queries
- **src/utils/** - Shared utilities (config, paths, errors)
- **src/types.ts** - TypeScript type definitions

### Database Schema

The database uses denormalized fields for performance:

- **files** - File metadata with symbol/dependency counts
- **symbols** - Symbol definitions with location and kind
- **dependencies** - File-to-file dependencies with symbol lists
- **symbol_references** - Where symbols are used
- **packages** - External package information
- **metadata** - System metadata (last indexed, counts)

For detailed schema and query patterns, see [CLAUDE.md](./CLAUDE.md).

## Common Development Tasks

### Adding a New Command

1. Create a new file in `src/commands/` (e.g., `mynewcommand.ts`)
2. Implement the command function
3. Export the command in `src/index.ts`
4. Add tests in `src/commands/mynewcommand.test.ts`
5. Update README.md command reference

### Adding a New Query

1. Add the query function in `src/db/queries.ts`
2. Add tests in `src/db/queries.test.ts`
3. Use the query in your command

### Modifying the Database Schema

1. Update `src/converter/schema.sql`
2. Update conversion logic in `src/converter/convert.ts`
3. Increment the schema version if needed
4. Add migration logic if backward compatibility is required

## Troubleshooting Development Issues

### Tests Failing

- Ensure you have the latest dependencies: `bun install`
- Check that `.dora/dora.db` exists: `dora index`
- Run tests in verbose mode: `DEBUG=* bun test`

### Build Issues

- Clear the dist directory: `rm -rf dist`
- Reinstall Bun if needed
- Check Bun version: `bun --version` (should be 1.0+)

### Local Development

- Use `bun link` to link the development version
- Test with `dora --version` to ensure you're using the dev version
- Unlink with `bun unlink` when done

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for architecture questions
- Check [CLAUDE.md](./CLAUDE.md) for detailed implementation notes

> `dora` is intentionally minimal. Before proposing new features, consider if the problem can be solved with existing commands or `dora query`

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
