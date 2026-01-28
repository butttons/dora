import type { ToolMetadata } from "./metadata.ts";

export function createJsonSchema(tool: ToolMetadata): Record<string, any> {
	const properties: Record<string, any> = {};
	const required: string[] = [];

	for (const arg of tool.arguments) {
		properties[arg.name] = {
			type: "string",
			description: arg.description,
		};
		if (arg.required) {
			required.push(arg.name);
		}
	}

	for (const opt of tool.options) {
		const property: Record<string, any> = {
			description: opt.description,
		};

		if (opt.type === "number") {
			property.type = "number";
		} else if (opt.type === "boolean") {
			property.type = "boolean";
		} else {
			property.type = "string";
		}

		properties[opt.name] = property;

		if (opt.required) {
			required.push(opt.name);
		}
	}

	const schema: Record<string, any> = {
		type: "object",
		properties,
	};

	if (required.length > 0) {
		schema.required = required;
	}

	return schema;
}
