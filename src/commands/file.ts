// dora file command

import {
  getFileDependencies,
  getFileDependents,
  getFileSymbols,
} from "../db/queries.ts";
import type { FileResult } from "../types.ts";
import { outputJson, resolveAndValidatePath, setupCommand } from "./shared.ts";

export async function file(path: string): Promise<void> {
  const ctx = await setupCommand();
  const relativePath = resolveAndValidatePath(ctx, path);

  const symbols = getFileSymbols(ctx.db, relativePath);
  const depends_on = getFileDependencies(ctx.db, relativePath);
  const depended_by = getFileDependents(ctx.db, relativePath);

  const result: FileResult = {
    path: relativePath,
    symbols,
    depends_on,
    depended_by,
  };

  outputJson(result);
}
