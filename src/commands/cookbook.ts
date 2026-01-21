import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { loadConfig } from "../utils/config.ts";
import { getDoraDir } from "../utils/paths.ts";
import { outputJson } from "./shared.ts";

type CookbookOptions = {
  format?: "json" | "markdown";
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
  options: CookbookOptions = {}
): Promise<void> {
  const config = await loadConfig();
  const cookbookDir = join(getDoraDir(config.root), "cookbook");
  const format = options.format || "json";
  const recipes = getAvailableRecipes(cookbookDir);

  if (format === "markdown") {
    console.log("Available recipes:\n");
    for (const r of recipes) {
      console.log(`  - ${r}`);
    }
    console.log("\nView a recipe: dora cookbook show <recipe>");
    console.log("Example: dora cookbook show quickstart");
  } else {
    outputJson({
      recipes,
      total: recipes.length,
    });
  }
}

export async function cookbookShow(
  recipe: string = "",
  options: CookbookOptions = {}
): Promise<void> {
  const config = await loadConfig();
  const cookbookDir = join(getDoraDir(config.root), "cookbook");
  const format = options.format || "json";
  const templateName = recipe ? `${recipe}.md` : "index.md";
  const templatePath = join(cookbookDir, templateName);

  try {
    const content = readFileSync(templatePath, "utf-8");

    if (format === "markdown") {
      console.log(content.trim());
    } else {
      outputJson({
        recipe: recipe || "index",
        content: content.trim(),
      });
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("ENOENT")) {
      const availableRecipes = getAvailableRecipes(cookbookDir);
      throw new Error(
        `Recipe '${recipe}' not found. Available recipes: ${availableRecipes.join(", ")}\n\nCookbook files missing. Run 'dora init' to restore them.`
      );
    }
    throw error;
  }
}
