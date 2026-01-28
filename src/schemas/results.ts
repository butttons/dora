import { z } from "zod";

export const TestsResultSchema = z.object({
	file: z.string(),
	tests: z.array(z.string()),
});

export type TestsResult = z.infer<typeof TestsResultSchema>;
