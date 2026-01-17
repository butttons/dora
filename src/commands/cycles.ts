/**
 * ctx cycles - Find bidirectional dependencies (A ↔ B)
 */

import type { CyclesResult } from "../types.ts";
import { getCycles } from "../db/queries.ts";
import { outputJson, parseIntFlag, setupCommand } from "./shared.ts";

export async function cycles(
	flags: Record<string, string | boolean> = {},
): Promise<void> {
	const { db } = await setupCommand();

	const limit = parseIntFlag(flags, "limit", 50);

	// Get bidirectional dependencies
	const cyclesList = getCycles(db, limit);

	const result: CyclesResult = {
		cycles: cyclesList,
	};

	outputJson(result);
}
