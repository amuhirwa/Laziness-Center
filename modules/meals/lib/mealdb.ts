import type { Ingredient, Step } from "@/db/schema"

export type MealDBMeal = {
  idMeal: string
  strMeal: string
  strCategory: string | null
  strArea: string | null
  strInstructions: string | null
  strMealThumb: string | null
  strSource: string | null
  [key: string]: string | null
}

export type MealDBResult = {
  id: string
  name: string
  category: string | null
  area: string | null
  thumbnail: string | null
}

function parseFraction(s: string): number {
  if (s.includes("/")) {
    const [n, d] = s.split("/").map(Number)
    return n / d
  }
  return parseFloat(s)
}

function parseMeasure(raw: string): { quantity: number | null; unit: string | null } {
  const s = raw.trim()
  if (!s) return { quantity: null, unit: null }

  // Match: optional whole number, optional fraction, then unit words
  // e.g. "1 1/2 cups", "3/4 tsp", "2 tbsp", "1 lb"
  const m = s.match(/^((?:\d+\s+)?\d+\/\d+|\d+(?:\.\d+)?)\s*(.*)$/)
  if (!m) return { quantity: null, unit: s || null }

  let quantity = 0
  const numPart = m[1].trim()
  if (numPart.includes(" ")) {
    const [whole, frac] = numPart.split(/\s+/)
    quantity = parseInt(whole) + parseFraction(frac)
  } else {
    quantity = parseFraction(numPart)
  }

  const unit = m[2].trim() || null
  return { quantity: isNaN(quantity) ? null : quantity, unit }
}

export function parseMealDBIngredients(meal: MealDBMeal): Ingredient[] {
  const result: Ingredient[] = []
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`]?.trim()
    if (!name) break
    const { quantity, unit } = parseMeasure(meal[`strMeasure${i}`] ?? "")
    result.push({ name, quantity, unit })
  }
  return result
}

export function parseMealDBSteps(instructions: string | null): { steps: Step[]; hasStructured: boolean } {
  if (!instructions?.trim()) return { steps: [], hasStructured: false }

  const lines = instructions
    .split(/\r?\n/)
    .map((l) => l.replace(/^(STEP\s*\d+\.?|Step\s*\d+\.?|\d+\.)\s*/i, "").trim())
    .filter((l) => l.length > 0)

  if (lines.length > 1) {
    return { steps: lines.map((text) => ({ text })), hasStructured: true }
  }
  // Single blob — split on ". " boundaries as a best-effort
  const sentences = instructions
    .split(/(?<=\.)\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10)
  if (sentences.length > 1) {
    return { steps: sentences.map((text) => ({ text })), hasStructured: true }
  }
  return { steps: [{ text: instructions.trim() }], hasStructured: false }
}

export function mealDBToRecipe(meal: MealDBMeal) {
  const { steps, hasStructured } = parseMealDBSteps(meal.strInstructions)
  const tags: string[] = []
  if (meal.strCategory) tags.push(meal.strCategory.toLowerCase())
  if (meal.strArea) tags.push(meal.strArea.toLowerCase())

  return {
    name: meal.strMeal,
    ingredients: parseMealDBIngredients(meal),
    steps,
    hasStructuredSteps: hasStructured,
    tags,
    sourceUrl: meal.strSource ?? `https://www.themealdb.com/meal/${meal.idMeal}`,
    thumbnailUrl: meal.strMealThumb ?? undefined,
  }
}

export type MealDBCategory = {
  idCategory: string
  strCategory: string
  strCategoryThumb: string
  strCategoryDescription: string
}

export type MealDBSummary = {
  idMeal: string
  strMeal: string
  strMealThumb: string
}

export async function getCategories(): Promise<MealDBCategory[]> {
  const res = await fetch("https://www.themealdb.com/api/json/v1/1/categories.php",
    { signal: AbortSignal.timeout(8000) }
  )
  if (!res.ok) return []
  const data = await res.json() as { categories: MealDBCategory[] | null }
  return data.categories ?? []
}

export async function getMealsByCategory(category: string): Promise<MealDBSummary[]> {
  const res = await fetch(
    `https://www.themealdb.com/api/json/v1/1/filter.php?c=${encodeURIComponent(category)}`,
    { signal: AbortSignal.timeout(8000) }
  )
  if (!res.ok) return []
  const data = await res.json() as { meals: MealDBSummary[] | null }
  return data.meals ?? []
}

export async function getMealById(id: string): Promise<MealDBMeal | null> {
  const res = await fetch(
    `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`,
    { signal: AbortSignal.timeout(8000) }
  )
  if (!res.ok) return null
  const data = await res.json() as { meals: MealDBMeal[] | null }
  return data.meals?.[0] ?? null
}

export async function searchMealDB(query: string): Promise<MealDBMeal[]> {
  const res = await fetch(
    `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`,
    { signal: AbortSignal.timeout(8000) }
  )
  if (!res.ok) return []
  const data = await res.json() as { meals: MealDBMeal[] | null }
  return data.meals ?? []
}

export async function getRandomMeal(): Promise<MealDBMeal | null> {
  const res = await fetch("https://www.themealdb.com/api/json/v1/1/random.php",
    { signal: AbortSignal.timeout(8000) }
  )
  if (!res.ok) return null
  const data = await res.json() as { meals: MealDBMeal[] | null }
  return data.meals?.[0] ?? null
}
