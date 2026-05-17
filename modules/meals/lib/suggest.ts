/**
 * Weighted-random suggestion algorithm.
 * See docs/modules/meals.md §5 GET /api/suggestions for the full spec.
 */
import { db } from "@/db"
import { cookedLog, recipes, suggestionCache } from "@/db/schema"
import type { Ingredient } from "@/db/schema"
import { and, avg, eq, gte, isNotNull } from "drizzle-orm"
import { availabilityFraction } from "./pantry"

const RECENT_COOK_DAYS = parseInt(process.env.MEALS_RECENT_COOK_DAYS ?? "7")

export type Suggestion = {
  recipeId: string
  name: string
  timeMinutes: number | null
  difficulty: string | null
  missingIngredients: string[] | null // null = pantry unreachable
  pantryCheckAvailable: boolean
}

export async function getSuggestions(
  userId: string,
  count: number,
  mealType?: string
): Promise<Suggestion[]> {
  const allRecipes = await db.select().from(recipes)
  if (allRecipes.length === 0) return []

  // Recipes cooked within the exclusion window
  const cutoff = new Date(Date.now() - RECENT_COOK_DAYS * 86400_000)
  const recentRows = await db
    .select({ recipeId: cookedLog.recipeId })
    .from(cookedLog)
    .where(and(eq(cookedLog.userId, userId), gte(cookedLog.cookedAt, cutoff)))
  const recentIds = new Set(recentRows.map((r) => r.recipeId))

  // Average ratings per recipe for this user
  const ratingRows = await db
    .select({ recipeId: cookedLog.recipeId, avgRating: avg(cookedLog.rating) })
    .from(cookedLog)
    .where(and(eq(cookedLog.userId, userId), isNotNull(cookedLog.rating)))
    .groupBy(cookedLog.recipeId)
  const ratingMap = new Map(ratingRows.map((r) => [r.recipeId, parseFloat(r.avgRating ?? "0")]))

  // Filter pool
  let pool = allRecipes.filter((r) => !recentIds.has(r.id))

  if (mealType) {
    const typed = pool.filter((r) => r.mealTypes.includes(mealType))
    if (typed.length >= count) {
      pool = typed
    } else {
      // Relax recent-cook exclusion first
      const allTyped = allRecipes.filter((r) => r.mealTypes.includes(mealType))
      pool = allTyped.length >= count ? allTyped : allRecipes
    }
  }

  // Check pantry availability for all ingredients in the pool at once
  const allIngredients = [...new Set(pool.flatMap((r) => (r.ingredients as Ingredient[]).map((i) => i.name)))]
  let availableSet: Set<string> | null = null
  let pantryOk = false
  try {
    const { checkIngredients } = await import("./pantry")
    const result = await checkIngredients(allIngredients)
    if (result) {
      availableSet = new Set(result.available)
      pantryOk = true
    }
  } catch { /* pantry unreachable */ }

  // Score each recipe
  type Scored = { recipe: typeof allRecipes[0]; score: number }
  const scored: Scored[] = pool.map((recipe) => {
    let score = 1.0
    if (recipe.isPinned) score *= 3.0

    if (availableSet !== null) {
      const ings = recipe.ingredients as Ingredient[]
      const fraction = ings.length === 0
        ? 1
        : ings.filter((i) => availableSet!.has(i.name)).length / ings.length
      if (fraction >= 0.8) score *= 2.0
      else if (fraction >= 0.5) score *= 1.5
    }

    const rating = ratingMap.get(recipe.id)
    if (rating) score *= rating / 3

    return { recipe, score }
  })

  const selected = weightedRandomSample(scored, count)

  // Build suggestion objects with missing ingredients
  return selected.map(({ recipe }) => {
    const ings = recipe.ingredients as Ingredient[]
    const missing = pantryOk && availableSet
      ? ings.filter((i) => i.name && !availableSet!.has(i.name)).map((i) => i.name)
      : null

    return {
      recipeId: recipe.id,
      name: recipe.name,
      timeMinutes: recipe.timeMinutes ?? null,
      difficulty: recipe.difficulty ?? null,
      missingIngredients: missing,
      pantryCheckAvailable: pantryOk,
    }
  })
}

function weightedRandomSample<T extends { score: number }>(items: T[], n: number): T[] {
  if (items.length <= n) return items
  const result: T[] = []
  const pool = [...items]
  for (let i = 0; i < n && pool.length > 0; i++) {
    const total = pool.reduce((s, x) => s + x.score, 0)
    let rand = Math.random() * total
    for (let j = 0; j < pool.length; j++) {
      rand -= pool[j].score
      if (rand <= 0) {
        result.push(pool.splice(j, 1)[0])
        break
      }
    }
  }
  return result
}
