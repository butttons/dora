-- database schema for dora CLI
-- Optimized for read performance with denormalized data

-- Files table with change tracking
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT UNIQUE NOT NULL,
  language TEXT,
  mtime INTEGER NOT NULL,
  symbol_count INTEGER DEFAULT 0,
  indexed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
CREATE INDEX IF NOT EXISTS idx_files_mtime ON files(mtime);

-- Symbols table with flattened location data
CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  scip_symbol TEXT,
  kind TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  start_char INTEGER NOT NULL,
  end_char INTEGER NOT NULL,
  documentation TEXT,
  package TEXT,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_file_id ON symbols(file_id);
CREATE INDEX IF NOT EXISTS idx_symbols_package ON symbols(package);
CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);

-- Pre-computed dependencies table
CREATE TABLE IF NOT EXISTS dependencies (
  from_file_id INTEGER NOT NULL,
  to_file_id INTEGER NOT NULL,
  symbol_count INTEGER DEFAULT 1,
  symbols TEXT,
  PRIMARY KEY (from_file_id, to_file_id),
  FOREIGN KEY (from_file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (to_file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_deps_from ON dependencies(from_file_id);
CREATE INDEX IF NOT EXISTS idx_deps_to ON dependencies(to_file_id);

-- Symbol references table (tracks where symbols are used)
CREATE TABLE IF NOT EXISTS symbol_references (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL,
  line INTEGER NOT NULL,
  FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refs_symbol ON symbol_references(symbol_id);
CREATE INDEX IF NOT EXISTS idx_refs_file ON symbol_references(file_id);
CREATE INDEX IF NOT EXISTS idx_refs_line ON symbol_references(symbol_id, file_id, line);

-- Packages table
CREATE TABLE IF NOT EXISTS packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  manager TEXT NOT NULL,
  version TEXT,
  symbol_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_packages_name ON packages(name);

-- Metadata table for system info
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
