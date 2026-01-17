/**
 * ctx coupling - Find tightly coupled file pairs
 */

import type { CouplingResult } from "../types.ts";
import { getCoupledFiles } from "../db/queries.ts";
import { outputJson, parseIntFlag, setupCommand } from "./shared.ts";

export async function coupling(
	flags: Record<string, string | boolean> = {},
): Promise<void> {
	const { db } = await setupCommand();

	const threshold = parseIntFlag(flags, "threshold", 5);

	// Get coupled files
	const coupledFiles = getCoupledFiles(db, threshold);

	const result: CouplingResult = {
		threshold,
		coupled_files: coupledFiles,
	};

	outputJson(result);
}
