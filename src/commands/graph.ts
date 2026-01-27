import { getDependencies, getReverseDependencies } from "../db/queries.ts";
import type { GraphEdge, GraphResult } from "../types.ts";
import { CtxError } from "../utils/errors.ts";
import {
  DEFAULTS,
  outputJson,
  parseIntFlag,
  parseStringFlag,
  resolveAndValidatePath,
  setupCommand,
} from "./shared.ts";

const VALID_DIRECTIONS = ["deps", "rdeps", "both"] as const;

export async function graph(
  path: string,
  flags: Record<string, string | boolean> = {}
): Promise<void> {
  const ctx = await setupCommand();
  const depth = parseIntFlag({
    flags,
    key: "depth",
    defaultValue: DEFAULTS.DEPTH,
  });
  const direction = parseStringFlag({
    flags,
    key: "direction",
    defaultValue: "both",
  });

  if (
    !VALID_DIRECTIONS.includes(direction as (typeof VALID_DIRECTIONS)[number])
  ) {
    throw new CtxError(
      `Invalid direction: ${direction}. Must be one of: deps, rdeps, both`
    );
  }

  const relativePath = resolveAndValidatePath({ ctx, inputPath: path });

  // Build graph
  const nodes = new Set<string>();
  const edges: GraphEdge[] = [];

  nodes.add(relativePath);

  if (direction === "deps" || direction === "both") {
    const deps = getDependencies(ctx.db, relativePath, depth);
    deps.forEach((dep) => {
      nodes.add(dep.path);
      edges.push({ from: relativePath, to: dep.path });
    });
  }

  if (direction === "rdeps" || direction === "both") {
    const rdeps = getReverseDependencies(ctx.db, relativePath, depth);
    rdeps.forEach((rdep) => {
      nodes.add(rdep.path);
      edges.push({ from: rdep.path, to: relativePath });
    });
  }

  const result: GraphResult = {
    root: relativePath,
    direction,
    depth,
    nodes: Array.from(nodes),
    edges,
  };

  outputJson(result);
}
