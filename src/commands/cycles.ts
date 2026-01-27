/**
 * dora cycles - Find bidirectional dependencies (A ↔ B)
 */

import { getCycles } from "../db/queries.ts";
import type { CyclesResult } from "../types.ts";
import { parseIntFlag, setupCommand } from "./shared.ts";

export async function cycles(
	flags: Record<string, string | boolean> = {},
): Promise<CyclesResult> {
	const { db } = await setupCommand();

	const limit = parseIntFlag({ flags, key: "limit", defaultValue: 50 });

	// Get bidirectional dependencies
	const cyclesList = getCycles(db, limit);

	return {
		cycles: cyclesList,
	};
}
