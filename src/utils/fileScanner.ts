import { readdir, stat, readFile } from "fs/promises";
import { join, relative } from "path";
import ignore from "ignore";
import { debugScanner } from "./logger.js";

export interface DocumentFile {
  path: string; // relative to repo root
  mtime: number; // unix timestamp in milliseconds
  type: string; // file extension without dot (md, json, yaml, toml)
}

/**
 * Scan for documentation files in the repository with .gitignore support
 */
export async function scanDocumentFiles(
  repoRoot: string,
  extensions: string[] = [".md", ".json", ".yaml", ".yml", ".toml", ".txt"]
): Promise<DocumentFile[]> {
  debugScanner("Scanning for document files in %s", repoRoot);
  debugScanner("Extensions: %o", extensions);

  // Load .gitignore patterns
  const ig = await loadGitignorePatterns(repoRoot);

  // Add default ignore patterns
  ig.add([
    "node_modules/",
    ".git/",
    ".dora/",
    "dist/",
    "build/",
    "coverage/",
    ".next/",
    ".nuxt/",
    "out/",
    "*.log",
  ]);

  const documents: DocumentFile[] = [];
  await walkDirectory(repoRoot, repoRoot, extensions, ig, documents);

  debugScanner("Found %d document files", documents.length);
  return documents;
}

/**
 * Load .gitignore patterns from the repository
 */
async function loadGitignorePatterns(repoRoot: string): Promise<ReturnType<typeof ignore>> {
  const ig = ignore();

  try {
    const gitignorePath = join(repoRoot, ".gitignore");
    const content = await readFile(gitignorePath, "utf-8");
    ig.add(content);
    debugScanner("Loaded .gitignore from %s", gitignorePath);
  } catch (error) {
    debugScanner(".gitignore not found or unreadable, using defaults only");
  }

  return ig;
}

/**
 * Recursively walk directory tree and collect document files
 */
async function walkDirectory(
  repoRoot: string,
  currentDir: string,
  extensions: string[],
  ig: ReturnType<typeof ignore>,
  documents: DocumentFile[]
): Promise<void> {
  let entries;
  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch (error) {
    debugScanner("Cannot read directory %s: %s", currentDir, error);
    return;
  }

  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);
    const relativePath = relative(repoRoot, fullPath);

    // Skip if ignored by .gitignore
    if (ig.ignores(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      // Recursively walk subdirectories
      await walkDirectory(repoRoot, fullPath, extensions, ig, documents);
    } else if (entry.isFile()) {
      // Check if file has a matching extension
      const hasMatchingExtension = extensions.some((ext) =>
        entry.name.endsWith(ext)
      );

      if (hasMatchingExtension) {
        try {
          const fileStat = await stat(fullPath);
          const ext = extensions.find((e) => entry.name.endsWith(e))!;
          const type = ext.startsWith(".") ? ext.slice(1) : ext;

          documents.push({
            path: relativePath,
            mtime: Math.floor(fileStat.mtimeMs),
            type,
          });
        } catch (error) {
          debugScanner("Cannot stat file %s: %s", fullPath, error);
        }
      }
    }
  }
}

/**
 * Filter documents based on modification time (for incremental indexing)
 */
export function filterChangedDocuments(
  existingDocs: Map<string, number>, // path -> mtime
  scannedDocs: DocumentFile[]
): DocumentFile[] {
  return scannedDocs.filter((doc) => {
    const existingMtime = existingDocs.get(doc.path);
    if (!existingMtime) {
      // New document
      return true;
    }
    // Document modified
    return doc.mtime > existingMtime;
  });
}
