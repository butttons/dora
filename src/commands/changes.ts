import { getReverseDependencies } from "../db/queries.ts";
import type { ChangesResult } from "../types.ts";
import { CtxError } from "../utils/errors.ts";
import { getChangedFiles, isGitRepo } from "../utils/git.ts";
import { DEFAULTS, outputJson, setupCommand } from "./shared.ts";

export async function changes(
  ref: string,
  _flags: Record<string, string | boolean> = {}
): Promise<void> {
  if (!(await isGitRepo())) {
    throw new CtxError("Not a git repository");
  }

  const ctx = await setupCommand();
  const changedFiles = await getChangedFiles(ref);

  // For each changed file, get its reverse dependencies (depth 1)
  const impacted = new Set<string>();

  for (const file of changedFiles) {
    try {
      const rdeps = getReverseDependencies(ctx.db, file, DEFAULTS.DEPTH);
      rdeps.forEach((dep) => {
        impacted.add(dep.path);
      });
    } catch {}
  }

  const result: ChangesResult = {
    ref,
    changed: changedFiles,
    impacted: Array.from(impacted),
    total_impacted: impacted.size,
  };

  outputJson(result);
}
