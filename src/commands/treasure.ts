import {
	getMostDependentFiles,
	getMostReferencedFiles,
} from "../db/queries.ts";
import type { HotspotsResult } from "../types.ts";
import { DEFAULTS, parseIntFlag, setupCommand } from "./shared.ts";

export async function treasure(
	flags: Record<string, string | boolean> = {},
): Promise<HotspotsResult> {
	const ctx = await setupCommand();
	const limit = parseIntFlag({
		flags,
		key: "limit",
		defaultValue: DEFAULTS.HOTSPOTS_LIMIT,
	});

	const mostReferenced = getMostReferencedFiles(ctx.db, limit);
	const mostDependencies = getMostDependentFiles(ctx.db, limit);

	return {
		most_referenced: mostReferenced,
		most_dependencies: mostDependencies,
	};
}
