import { getFileCount, getPackages, getSymbolCount } from "../db/queries.ts";
import type { OverviewResult } from "../types.ts";
import { outputJson, setupCommand } from "./shared.ts";

export async function map(): Promise<void> {
	const { db } = await setupCommand();

	// Query overview data
	const packages = getPackages(db);
	const file_count = getFileCount(db);
	const symbol_count = getSymbolCount(db);

	const result: OverviewResult = {
		packages,
		file_count,
		symbol_count,
	};

	outputJson(result);
}
