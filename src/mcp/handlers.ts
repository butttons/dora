import { match } from "ts-pattern";
import { adventure } from "../commands/adventure.ts";
import { changes } from "../commands/changes.ts";
import { complexity } from "../commands/complexity.ts";
import { cookbookList, cookbookShow } from "../commands/cookbook.ts";
import { coupling } from "../commands/coupling.ts";
import { cycles } from "../commands/cycles.ts";
import { deps } from "../commands/deps.ts";
import { docsList } from "../commands/docs/list.ts";
import { docsSearch } from "../commands/docs/search.ts";
import { docsShow } from "../commands/docs/show.ts";
import { exports } from "../commands/exports.ts";
import { file } from "../commands/file.ts";
import { graph } from "../commands/graph.ts";
import { imports } from "../commands/imports.ts";
import { index } from "../commands/index.ts";
import { init } from "../commands/init.ts";
import { leaves } from "../commands/leaves.ts";
import { lost } from "../commands/lost.ts";
import { ls } from "../commands/ls.ts";
import { map } from "../commands/map.ts";
import { query } from "../commands/query.ts";
import { rdeps } from "../commands/rdeps.ts";
import { refs } from "../commands/refs.ts";
import { schema } from "../commands/schema.ts";
import { status } from "../commands/status.ts";
import { symbol } from "../commands/symbol.ts";
import { treasure } from "../commands/treasure.ts";

export async function handleToolCall(
	name: string,
	args: Record<string, any>,
): Promise<any> {
	return match(name)
		.with("dora_init", async () => {
			return await init({ language: args.language });
		})
		.with("dora_index", async () => {
			return await index({
				full: args.full,
				skipScip: args.skipScip,
				ignore: args.ignore ? [args.ignore].flat() : undefined,
			});
		})
		.with("dora_status", async () => {
			return await status();
		})
		.with("dora_map", async () => {
			return await map();
		})
		.with("dora_ls", async () => {
			return await ls(args.directory, {
				limit: args.limit,
				sort: args.sort,
			});
		})
		.with("dora_file", async () => {
			return await file(args.path);
		})
		.with("dora_symbol", async () => {
			return await symbol(args.query, {
				limit: args.limit,
				kind: args.kind,
			});
		})
		.with("dora_refs", async () => {
			return await refs(args.symbol, {
				kind: args.kind,
				limit: args.limit,
			});
		})
		.with("dora_deps", async () => {
			return await deps(args.path, {
				depth: args.depth,
			});
		})
		.with("dora_rdeps", async () => {
			return await rdeps(args.path, {
				depth: args.depth,
			});
		})
		.with("dora_adventure", async () => {
			return await adventure(args.from, args.to);
		})
		.with("dora_leaves", async () => {
			return await leaves({
				maxDependents: args.maxDependents,
			});
		})
		.with("dora_exports", async () => {
			return await exports(args.target);
		})
		.with("dora_imports", async () => {
			return await imports(args.path);
		})
		.with("dora_lost", async () => {
			return await lost({
				limit: args.limit,
			});
		})
		.with("dora_treasure", async () => {
			return await treasure({
				limit: args.limit,
			});
		})
		.with("dora_changes", async () => {
			return await changes(args.ref);
		})
		.with("dora_graph", async () => {
			return await graph(args.path, {
				depth: args.depth,
				direction: args.direction,
			});
		})
		.with("dora_cycles", async () => {
			return await cycles({
				limit: args.limit,
			});
		})
		.with("dora_coupling", async () => {
			return await coupling({
				threshold: args.threshold,
			});
		})
		.with("dora_complexity", async () => {
			return await complexity({
				sort: args.sort,
			});
		})
		.with("dora_schema", async () => {
			return await schema();
		})
		.with("dora_query", async () => {
			return await query(args.sql);
		})
		.with("dora_cookbook_list", async () => {
			return await cookbookList({
				format: args.format,
			});
		})
		.with("dora_cookbook_show", async () => {
			return await cookbookShow(args.recipe, {
				format: args.format,
			});
		})
		.with("dora_docs_list", async () => {
			return await docsList({
				type: args.type,
			});
		})
		.with("dora_docs_search", async () => {
			return await docsSearch(args.query, {
				limit: args.limit,
			});
		})
		.with("dora_docs_show", async () => {
			return await docsShow(args.path, {
				content: args.content,
			});
		})
		.otherwise(() => {
			throw new Error(`Unknown tool: ${name}`);
		});
}
