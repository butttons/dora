#!/usr/bin/env bun

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import packageJson from "../package.json";
import { handleToolCall } from "./mcp/handlers.ts";
import { createJsonSchema } from "./mcp/jsonSchemas.ts";
import { toolsMetadata } from "./mcp/metadata.ts";

export async function startMcpServer(): Promise<void> {
	const server = new Server(
		{
			name: "dora",
			version: packageJson.version,
		},
		{
			capabilities: {
				tools: {},
			},
		},
	);

	server.setRequestHandler(ListToolsRequestSchema, async () => {
		const tools = toolsMetadata.map((tool) => {
			return {
				name: tool.name,
				description: tool.description,
				inputSchema: createJsonSchema(tool),
			};
		});

		return { tools };
	});

	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		try {
			const result = await handleToolCall(
				request.params.name,
				request.params.arguments || {},
			);

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ error: errorMessage }, null, 2),
					},
				],
				isError: true,
			};
		}
	});

	const transport = new StdioServerTransport();
	await server.connect(transport);

	console.error("Dora MCP Server running on stdio");
}

if (import.meta.main) {
	startMcpServer().catch((error) => {
		console.error("Fatal error:", error);
		process.exit(1);
	});
}
