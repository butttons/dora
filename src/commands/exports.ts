import {
  fileExists,
  getFileExports,
  getPackageExports,
} from "../db/queries.ts";
import type { ExportsResult } from "../types.ts";
import { CtxError } from "../utils/errors.ts";
import { resolvePath, setupCommand } from "./shared.ts";

export async function exports(
  target: string,
  _flags: Record<string, string | boolean> = {}
): Promise<ExportsResult> {
  const ctx = await setupCommand();

  // Try as file path first
  const relativePath = resolvePath({ ctx, inputPath: target });

  if (fileExists(ctx.db, relativePath)) {
    const exportedSymbols = getFileExports(ctx.db, relativePath);
    if (exportedSymbols.length > 0) {
      const result: ExportsResult = {
        target: relativePath,
        exports: exportedSymbols,
      };
      return result;
    }
  }

  // Try as package name
  const packageExports = getPackageExports(ctx.db, target);
  if (packageExports.length > 0) {
    const result: ExportsResult = {
      target,
      exports: packageExports,
    };
    return result;
  }

  throw new CtxError(`No exports found for '${target}'`);
}
