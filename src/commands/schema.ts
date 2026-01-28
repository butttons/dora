import { setupCommand } from "./shared.ts";

export interface SchemaInfo {
	tables: Array<{
		name: string;
		columns: Array<{
			name: string;
			type: string;
			nullable: boolean;
			primary_key: boolean;
		}>;
		indexes: string[];
	}>;
}

export async function schema(): Promise<SchemaInfo> {
	const { db } = await setupCommand();

	// Get all tables
	const tablesQuery = `
    SELECT name FROM sqlite_master
    WHERE type='table'
    AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `;

	const tables = db.query(tablesQuery).all() as Array<{ name: string }>;

	const result: SchemaInfo = {
		tables: [],
	};

	for (const table of tables) {
		// Get column info
		const columnsQuery = `PRAGMA table_info(${table.name})`;
		const columns = db.query(columnsQuery).all() as Array<{
			cid: number;
			name: string;
			type: string;
			notnull: number;
			dflt_value: string | null;
			pk: number;
		}>;

		// Get indexes
		const indexesQuery = `
      SELECT sql FROM sqlite_master
      WHERE type='index'
      AND tbl_name=?
      AND sql IS NOT NULL
    `;
		const indexes = db.query(indexesQuery).all(table.name) as Array<{
			sql: string;
		}>;

		result.tables.push({
			name: table.name,
			columns: columns.map((col) => ({
				name: col.name,
				type: col.type,
				nullable: col.notnull === 0,
				primary_key: col.pk === 1,
			})),
			indexes: indexes.map((idx) => idx.sql),
		});
	}

	return result;
}
