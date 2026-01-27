import { getFileCount, getPackages, getSymbolCount } from "../db/queries.ts";
import type { OverviewResult } from "../types.ts";
import { setupCommand } from "./shared.ts";

export async function map(): Promise<OverviewResult> {
	const { db } = await setupCommand();

	const packages = getPackages(db);
	const file_count = getFileCount(db);
	const symbol_count = getSymbolCount(db);

	return {
		packages,
		file_count,
		symbol_count,
	};
}
