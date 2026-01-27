import { z } from "zod";
import type { ToolMetadata } from "./metadata.ts";

export function createInputSchema(tool: ToolMetadata): z.ZodObject<any> {
	const shape: Record<string, z.ZodTypeAny> = {};

	for (const arg of tool.arguments) {
		if (arg.required) {
			shape[arg.name] = z.string().describe(arg.description);
		} else {
			shape[arg.name] = z.string().optional().describe(arg.description);
		}
	}

	for (const opt of tool.options) {
		let zodType: z.ZodTypeAny;

		if (opt.type === "number") {
			zodType = z.number();
		} else if (opt.type === "boolean") {
			zodType = z.boolean();
		} else {
			zodType = z.string();
		}

		if (opt.description) {
			zodType = zodType.describe(opt.description);
		}

		shape[opt.name] = opt.required ? zodType : zodType.optional();
	}

	return z.object(shape);
}
