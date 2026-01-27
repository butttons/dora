import type { Database } from "bun:sqlite";
import { getDependencies, getReverseDependencies } from "../db/queries.ts";
import type { PathResult } from "../types.ts";
import { CtxError } from "../utils/errors.ts";
import { DEFAULTS, resolveAndValidatePath, setupCommand } from "./shared.ts";

export async function adventure(from: string, to: string): Promise<PathResult> {
  const ctx = await setupCommand();

  const fromPath = resolveAndValidatePath({ ctx, inputPath: from });
  const toPath = resolveAndValidatePath({ ctx, inputPath: to });

  // If same file, return direct path
  if (fromPath === toPath) {
    return {
      from: fromPath,
      to: toPath,
      path: [fromPath],
      distance: 0,
    };
  }

  // Use BFS to find shortest path
  const foundPath = findShortestPath(ctx.db, fromPath, toPath);

  if (!foundPath) {
    throw new CtxError(`No path found from ${fromPath} to ${toPath}`);
  }

  return {
    from: fromPath,
    to: toPath,
    path: foundPath,
    distance: foundPath.length - 1,
  };
}

/**
 * Find shortest path using bidirectional BFS with iterative deepening.
 *
 * TODO: Optimize path finding algorithm
 * Current implementation uses iterative deepening with multiple DB queries (2 per depth level).
 * For large codebases with MAX_PATH_DEPTH=10, this can result in 20-40 queries.
 * Consider refactoring to bidirectional BFS with single SQL query or in-memory graph traversal.
 * This is not a blocker for release as path finding is infrequently used.
 */
function findShortestPath(
  db: Database,
  from: string,
  to: string
): string[] | null {
  // Try increasing depths until we find a path or reach max depth
  const maxDepth = DEFAULTS.MAX_PATH_DEPTH;

  for (let depth = 1; depth <= maxDepth; depth++) {
    // Get dependencies from 'from' file
    const forwardDeps = getDependencies(db, from, depth);
    const forwardSet = new Set(forwardDeps.map((d) => d.path));

    // Check if 'to' is in forward dependencies
    if (forwardSet.has(to)) {
      // Reconstruct path using BFS
      return reconstructPath(db, from, to, depth, true);
    }

    // Get reverse dependencies from 'to' file
    const reverseDeps = getReverseDependencies(db, to, depth);
    const reverseSet = new Set(reverseDeps.map((d) => d.path));

    // Check if 'from' is in reverse dependencies
    if (reverseSet.has(from)) {
      // Path exists in reverse direction
      return reconstructPath(db, from, to, depth, true);
    }

    // Check for intersection between forward and reverse
    for (const forwardFile of forwardSet) {
      if (reverseSet.has(forwardFile)) {
        // Found a connecting file
        const pathToMiddle = reconstructPath(
          db,
          from,
          forwardFile,
          depth,
          true
        );
        const pathFromMiddle = reconstructPath(
          db,
          forwardFile,
          to,
          depth,
          true
        );

        if (pathToMiddle && pathFromMiddle) {
          // Combine paths (remove duplicate middle file)
          return [...pathToMiddle, ...pathFromMiddle.slice(1)];
        }
      }
    }
  }

  return null;
}

/**
 * Reconstruct path using BFS
 */
function reconstructPath(
  db: Database,
  from: string,
  to: string,
  maxDepth: number,
  forward: boolean
): string[] | null {
  // Simple BFS implementation
  const queue: Array<{ file: string; path: string[] }> = [
    { file: from, path: [from] },
  ];
  const visited = new Set<string>([from]);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.file === to) {
      return current.path;
    }

    if (current.path.length > maxDepth) {
      continue;
    }

    // Get neighbors
    const neighbors = forward
      ? getDependencies(db, current.file, 1)
      : getReverseDependencies(db, current.file, 1);

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor.path)) {
        visited.add(neighbor.path);
        queue.push({
          file: neighbor.path,
          path: [...current.path, neighbor.path],
        });
      }
    }
  }

  return null;
}
