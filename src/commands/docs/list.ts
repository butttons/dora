import { setupCommand } from "../shared.ts";

export type DocsListResult = {
	documents: Array<{
		path: string;
		type: string;
		symbol_refs: number;
		file_refs: number;
		document_refs: number;
	}>;
	total: number;
};

export async function docsList(
	flags: Record<string, string | boolean> = {},
): Promise<DocsListResult> {
	const ctx = await setupCommand();
	const db = ctx.db;

	const type = typeof flags.type === "string" ? flags.type : undefined;

	const query = type
		? "SELECT path, type, symbol_count, file_count, document_count FROM documents WHERE type = ? ORDER BY path"
		: "SELECT path, type, symbol_count, file_count, document_count FROM documents ORDER BY path";

	const params = type ? [type] : [];
	const docs = db.query(query).all(...params) as Array<{
		path: string;
		type: string;
		symbol_count: number;
		file_count: number;
		document_count: number;
	}>;

	return {
		documents: docs.map((d) => ({
			path: d.path,
			type: d.type,
			symbol_refs: d.symbol_count,
			file_refs: d.file_count,
			document_refs: d.document_count,
		})),
		total: docs.length,
	};
}
