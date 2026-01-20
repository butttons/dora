import { getDocumentContent, getDocumentReferences } from "../../db/queries.ts";
import type { DocResult } from "../../types.ts";
import { outputJson, setupCommand } from "../shared.ts";

export async function docsShow(
	path: string,
	flags: Record<string, string | boolean> = {},
): Promise<void> {
	const ctx = await setupCommand();
	const db = ctx.db;

	const doc = getDocumentContent(db, path);

	if (!doc) {
		throw new Error(`Document not found: ${path}`);
	}

	const refs = getDocumentReferences(db, path);

	const result: DocResult = {
		path: doc.path,
		type: doc.type,
		symbol_refs: refs.symbols,
		file_refs: refs.files,
		document_refs: refs.documents,
		...(flags.content && { content: doc.content }),
	};

	outputJson(result);
}
