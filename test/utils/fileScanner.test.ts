// Tests for file scanner with .gitignore support

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import {
  filterChangedDocuments,
  scanDocumentFiles,
} from "../../src/utils/fileScanner.ts";

describe("File Scanner", () => {
  const testDir = join(process.cwd(), "test", "fixtures", "test-repo");

  beforeAll(async () => {
    // Create test directory structure
    await mkdir(testDir, { recursive: true });
    await mkdir(join(testDir, "docs"), { recursive: true });
    await mkdir(join(testDir, "node_modules"), { recursive: true });
    await mkdir(join(testDir, "src"), { recursive: true });

    // Create test files
    await writeFile(join(testDir, "README.md"), "# Test");
    await writeFile(join(testDir, "docs", "guide.md"), "# Guide");
    await writeFile(join(testDir, "node_modules", "foo.md"), "# Foo");
    await writeFile(join(testDir, "notes.txt"), "Project notes");

    // Create .gitignore
    await writeFile(join(testDir, ".gitignore"), "node_modules/\n*.log\n");
  });

  afterAll(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  test("should scan and find document files", async () => {
    const docs = await scanDocumentFiles({ repoRoot: testDir });

    expect(docs.length).toBeGreaterThan(0);
    expect(docs.some((d) => d.path.endsWith("README.md"))).toBe(true);
    expect(docs.some((d) => d.path.endsWith("guide.md"))).toBe(true);
    expect(docs.some((d) => d.path.endsWith("notes.txt"))).toBe(true);
  });

  test("should respect .gitignore rules", async () => {
    const docs = await scanDocumentFiles({ repoRoot: testDir });

    // Should not include files in node_modules
    expect(docs.some((d) => d.path.includes("node_modules"))).toBe(false);
  });

  test("should include file metadata", async () => {
    const docs = await scanDocumentFiles({ repoRoot: testDir });
    const readme = docs.find((d) => d.path.endsWith("README.md"));

    expect(readme).toBeDefined();
    expect(readme?.mtime).toBeGreaterThan(0);
    expect(readme?.type).toBe("md");
  });

  test("should filter by custom extensions", async () => {
    const docs = await scanDocumentFiles({
      repoRoot: testDir,
      extensions: [".md"],
    });

    expect(docs.every((d) => d.type === "md")).toBe(true);
    expect(docs.some((d) => d.type === "txt")).toBe(false);
  });

  test("should filter changed documents", () => {
    const existingDocs = new Map([
      ["README.md", 1000],
      ["docs/guide.md", 2000],
    ]);

    const scannedDocs = [
      { path: "README.md", mtime: 1000, type: "md" }, // unchanged
      { path: "docs/guide.md", mtime: 3000, type: "md" }, // modified
      { path: "NEW.md", mtime: 4000, type: "md" }, // new
    ];

    const changed = filterChangedDocuments({ existingDocs, scannedDocs });

    expect(changed.length).toBe(2);
    expect(changed.some((d) => d.path === "docs/guide.md")).toBe(true);
    expect(changed.some((d) => d.path === "NEW.md")).toBe(true);
    expect(changed.some((d) => d.path === "README.md")).toBe(false);
  });

  test("should scan and find .txt files", async () => {
    const docs = await scanDocumentFiles({ repoRoot: testDir });

    // Should include .txt files
    expect(docs.some((d) => d.path.endsWith("notes.txt"))).toBe(true);

    const txtFile = docs.find((d) => d.path.endsWith("notes.txt"));
    expect(txtFile?.type).toBe("txt");
  });

  test("should include .txt in default extensions", async () => {
    const docs = await scanDocumentFiles({ repoRoot: testDir });

    // Verify that .txt files are scanned by default
    const txtDocs = docs.filter((d) => d.type === "txt");
    expect(txtDocs.length).toBeGreaterThan(0);
  });
});
