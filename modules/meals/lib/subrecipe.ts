/**
 * Auto-detect sub-recipe candidates: finds recipes in the library whose name
 * fuzzy-matches an ingredient name. No schema changes required — detection is
 * purely at render time.
 *
 * Match logic (mirrors pantry normalize.ts):
 *   "tortillas"  matches  "Homemade Flour Tortillas"  (ingredient ⊂ recipe name)
 *   "bread"      matches  "Simple White Bread"         (ingredient ⊂ recipe name)
 *   "pasta dough" matches "Pasta Dough"                (exact after lowercase)
 */

export type RecipeStub = {
  id: string
  name: string
  timeMinutes: number | null
}

export function findSubRecipe(
  ingredientName: string,
  recipes: RecipeStub[]
): RecipeStub | null {
  const ing = ingredientName.toLowerCase().trim()
  if (ing.length < 3) return null

  // 1. Exact match
  let match = recipes.find((r) => r.name.toLowerCase() === ing)
  if (match) return match

  // 2. Ingredient name is contained in recipe name ("tortillas" in "Homemade Tortillas")
  match = recipes.find((r) => r.name.toLowerCase().includes(ing))
  if (match) return match

  // 3. Recipe name is contained in ingredient name ("pasta" in "dried pasta")
  match = recipes.find((r) => {
    const rn = r.name.toLowerCase()
    return rn.length >= 3 && ing.includes(rn)
  })
  return match ?? null
}
