#!/usr/bin/env bun

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import packageJson from "../package.json";
import { handleToolCall } from "./mcp/handlers.ts";
import { createInputSchema } from "./mcp/inputSchemas.ts";
import { toolsMetadata } from "./mcp/metadata.ts";

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
		const inputSchema = createInputSchema(tool);
		return {
			name: tool.name,
			description: tool.description,
			inputSchema: {
				type: "object",
				properties: inputSchema.shape,
			},
		};
	});

	return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
	try {
		const result = await handleToolCall(request.params.name, request.params.arguments || {});

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

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);

	console.error("Dora MCP Server running on stdio");
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
