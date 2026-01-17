// dora rdeps command

import { getReverseDependencies } from "../db/queries.ts";
import type { RDepsResult } from "../types.ts";
import {
  DEFAULTS,
  outputJson,
  parseIntFlag,
  resolveAndValidatePath,
  setupCommand,
} from "./shared.ts";

export async function rdeps(
  path: string,
  flags: Record<string, string | boolean> = {},
): Promise<void> {
  const ctx = await setupCommand();
  const depth = parseIntFlag(flags, "depth", DEFAULTS.DEPTH);
  const relativePath = resolveAndValidatePath(ctx, path);

  const dependents = getReverseDependencies(ctx.db, relativePath, depth);

  const result: RDepsResult = {
    path: relativePath,
    depth,
    dependents,
  };

  outputJson(result);
}
