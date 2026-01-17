// dora deps command

import { getDependencies } from "../db/queries.ts";
import type { DepsResult } from "../types.ts";
import {
  DEFAULTS,
  outputJson,
  parseIntFlag,
  resolveAndValidatePath,
  setupCommand,
} from "./shared.ts";

export async function deps(
  path: string,
  flags: Record<string, string | boolean> = {},
): Promise<void> {
  const ctx = await setupCommand();
  const depth = parseIntFlag(flags, "depth", DEFAULTS.DEPTH);
  const relativePath = resolveAndValidatePath(ctx, path);

  const dependencies = getDependencies(ctx.db, relativePath, depth);

  const result: DepsResult = {
    path: relativePath,
    depth,
    dependencies,
  };

  outputJson(result);
}
