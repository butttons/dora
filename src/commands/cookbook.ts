import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { loadConfig } from "../utils/config.ts";
import { getDoraDir } from "../utils/paths.ts";

type CookbookOptions = {
	format?: "json" | "markdown";
};

export type CookbookListResult = {
	recipes: string[];
	total: number;
};

export type CookbookShowResult = {
	recipe: string;
	content: string;
};

function getAvailableRecipes(cookbookDir: string): string[] {
	try {
		const files = readdirSync(cookbookDir);
		return files
			.filter((file) => file.endsWith(".md") && file !== "index.md")
			.map((file) => file.replace(".md", ""))
			.sort();
	} catch {
		return [];
	}
}

export async function cookbookList(
	options: CookbookOptions = {},
): Promise<CookbookListResult> {
	const config = await loadConfig();
	const cookbookDir = join(getDoraDir(config.root), "cookbook");
	const recipes = getAvailableRecipes(cookbookDir);

	return {
		recipes,
		total: recipes.length,
	};
}

export async function cookbookShow(
	recipe: string = "",
	options: CookbookOptions = {},
): Promise<CookbookShowResult> {
	const config = await loadConfig();
	const cookbookDir = join(getDoraDir(config.root), "cookbook");
	const templateName = recipe ? `${recipe}.md` : "index.md";
	const templatePath = join(cookbookDir, templateName);

	try {
		const content = readFileSync(templatePath, "utf-8");

		return {
			recipe: recipe || "index",
			content: content.trim(),
		};
	} catch (error) {
		if (error instanceof Error && error.message.includes("ENOENT")) {
			const availableRecipes = getAvailableRecipes(cookbookDir);
			throw new Error(
				`Recipe '${recipe}' not found. Available recipes: ${availableRecipes.join(", ")}\n\nCookbook files missing. Run 'dora init' to restore them.`,
			);
		}
		throw error;
	}
}
