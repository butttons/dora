/**
 * ctx complexity - File complexity metrics for refactoring prioritization
 */

import type { ComplexityResult } from "../types.ts";
import { getComplexityMetrics } from "../db/queries.ts";
import { outputJson, parseStringFlag, setupCommand } from "./shared.ts";

export async function complexity(
	flags: Record<string, string | boolean> = {},
): Promise<void> {
	const { db } = await setupCommand();

	const sortBy = parseStringFlag(flags, "sort", "complexity");

	// Validate sort option
	if (!["complexity", "symbols", "stability"].includes(sortBy)) {
		throw new Error(
			`Invalid sort option: ${sortBy}. Must be one of: complexity, symbols, stability`,
		);
	}

	// Get complexity metrics
	const files = getComplexityMetrics(db, sortBy);

	const result: ComplexityResult = {
		sort_by: sortBy,
		files,
	};

	outputJson(result);
}
