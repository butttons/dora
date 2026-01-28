import {
	getFileDependencies,
	getFileDependents,
	getFileSymbols,
} from "../db/queries.ts";
import type { FileResult } from "../types.ts";
import { resolveAndValidatePath, setupCommand } from "./shared.ts";

export async function file(path: string): Promise<FileResult> {
	const ctx = await setupCommand();
	const relativePath = resolveAndValidatePath({ ctx, inputPath: path });

	const symbols = getFileSymbols(ctx.db, relativePath);
	const depends_on = getFileDependencies(ctx.db, relativePath);
	const depended_by = getFileDependents(ctx.db, relativePath);

	const fileIdQuery = "SELECT id FROM files WHERE path = ?";
	const fileRow = ctx.db.query(fileIdQuery).get(relativePath) as {
		id: number;
	} | null;

	let documented_in: string[] | undefined;

	if (fileRow) {
		const docsQuery = `
      SELECT d.path
      FROM documents d
      JOIN document_file_refs dfr ON dfr.document_id = d.id
      WHERE dfr.file_id = ?
      ORDER BY d.path
    `;

		const docs = ctx.db.query(docsQuery).all(fileRow.id) as Array<{
			path: string;
		}>;

		if (docs.length > 0) {
			documented_in = docs.map((d) => d.path);
		}
	}

	const result: FileResult = {
		path: relativePath,
		symbols,
		depends_on,
		depended_by,
		...(documented_in && { documented_in }),
	};

	return result;
}
