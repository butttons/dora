// dora treasure command

import {
	getMostDependentFiles,
	getMostReferencedFiles,
} from "../db/queries.ts";
import type { HotspotsResult } from "../types.ts";
import { DEFAULTS, outputJson, parseIntFlag, setupCommand } from "./shared.ts";

export async function treasure(
	flags: Record<string, string | boolean> = {},
): Promise<void> {
	const ctx = await setupCommand();
	const limit = parseIntFlag(flags, "limit", DEFAULTS.HOTSPOTS_LIMIT);

	const mostReferenced = getMostReferencedFiles(ctx.db, limit);
	const mostDependencies = getMostDependentFiles(ctx.db, limit);

	const result: HotspotsResult = {
		most_referenced: mostReferenced,
		most_dependencies: mostDependencies,
	};

	outputJson(result);
}
