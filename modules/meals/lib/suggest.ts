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
  mealType?: string,
  tag?: string
): Promise<Suggestion[]> {
  const allRecipes = await db.select().from(recipes)
  if (allRecipes.length === 0) return []

  const matchesFilter = (r: typeof allRecipes[0]) => {
    if (mealType && !r.mealTypes.includes(mealType)) return false
    if (tag && !r.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return false
    return true
  }

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

  // Filter pool — relax recent-cook exclusion if needed
  let pool = allRecipes.filter((r) => !recentIds.has(r.id) && matchesFilter(r))
  if (pool.length < count) {
    const filtered = allRecipes.filter(matchesFilter)
    pool = filtered.length > 0 ? filtered : allRecipes
  }

  // Check pantry availability for all ingredients in the pool at once
  const allIngredients = [...new Set(pool.flatMap((r) => (r.ingredients as Ingredient[]).map((i) => i.name)))]
  let inStockSet: Set<string> | null = null
  let staplesSet: Set<string> | null = null
  let pantryOk = false
  try {
    const { checkIngredients } = await import("./pantry")
    const result = await checkIngredients(allIngredients)
    if (result) {
      inStockSet = new Set(result.available)
      staplesSet = new Set(result.staples ?? [])
      pantryOk = true
    }
  } catch { /* pantry unreachable */ }

  // Score each recipe
  type Scored = { recipe: typeof allRecipes[0]; score: number }
  const scored: Scored[] = pool.map((recipe) => {
    let score = 1.0
    if (recipe.isPinned) score *= 3.0

    if (inStockSet !== null) {
      const ings = recipe.ingredients as Ingredient[]
      if (ings.length > 0) {
        const inStock = ings.filter((i) => inStockSet!.has(i.name)).length
        const fromStaples = ings.filter((i) => staplesSet?.has(i.name)).length
        const allAvail = inStock + fromStaples
        const fraction = allAvail / ings.length
        // Availability multiplier (in-stock + staples)
        if (fraction >= 0.8) score *= 2.0
        else if (fraction >= 0.5) score *= 1.5
        // Extra bonus for having actual stock (not just staples)
        const inStockFraction = inStock / ings.length
        if (inStockFraction >= 0.5) score *= 1.3
      }
    }

    const rating = ratingMap.get(recipe.id)
    if (rating) score *= rating / 3

    return { recipe, score }
  })

  const selected = weightedRandomSample(scored, count)

  // Build suggestion objects with missing ingredients
  return selected.map(({ recipe }) => {
    const ings = recipe.ingredients as Ingredient[]
    const missing = pantryOk && inStockSet
      ? ings.filter((i) => i.name && !inStockSet!.has(i.name) && !staplesSet?.has(i.name)).map((i) => i.name)
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
