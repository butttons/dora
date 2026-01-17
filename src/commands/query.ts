// query command - Execute raw SQL queries

import { outputJson, setupCommand } from "./shared.ts";

export interface QueryResult {
	query: string;
	rows: Array<Record<string, unknown>>;
	row_count: number;
	columns: string[];
}

export async function query(sql: string) {
	const { db } = await setupCommand();

	// Note: The database connection is opened in read-only mode (see db/connection.ts)
	// SQLite will automatically block any write operations (INSERT, UPDATE, DELETE, etc.)
	// This is enforced at the SQLite level, not by string parsing

	try {
		const stmt = db.query(sql);
		const rows = stmt.all() as Array<Record<string, unknown>>;

		// Extract column names from first row
		const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

		const result: QueryResult = {
			query: sql,
			rows,
			row_count: rows.length,
			columns,
		};

		outputJson(result);
	} catch (error) {
		throw new Error(
			`SQL query failed: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}
