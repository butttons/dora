import { readFileSync } from "fs";
import { join } from "path";
import { outputJson } from "./shared.ts";

export async function cookbook(recipe: string = ""): Promise<void> {
  const templateName = recipe ? `${recipe}.md` : "index.md";
  const templatePath = join(
    import.meta.dir,
    "..",
    "templates",
    "cookbook",
    templateName
  );

  try {
    const content = readFileSync(templatePath, "utf-8");

    outputJson({
      recipe: recipe || "index",
      content: content.trim(),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("ENOENT")) {
      const availableRecipes = ["quickstart", "methods", "references", "exports"];
      throw new Error(
        `Recipe '${recipe}' not found. Available recipes: ${availableRecipes.join(", ")}\n\nRun 'dora cookbook' to see all recipes.`
      );
    }
    throw error;
  }
}
