/**
 * dora complexity - File complexity metrics for refactoring prioritization
 */

import { getComplexityMetrics } from "../db/queries.ts";
import type { ComplexityResult } from "../types.ts";
import { parseStringFlag, setupCommand } from "./shared.ts";

export async function complexity(
	flags: Record<string, string | boolean> = {},
): Promise<ComplexityResult> {
	const { db } = await setupCommand();

	const sortBy = parseStringFlag({
		flags,
		key: "sort",
		defaultValue: "complexity",
	});

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

	return result;
}
