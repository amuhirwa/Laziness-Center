import { lc } from "./sdk"
import type { LCError } from "@lc/sdk"

type CheckResult = { available: string[]; missing: string[]; low: string[] }
type PriceResult = {
  priced: Array<{ name: string; totalCost: number; currency: string }>
  unpriced: Array<{ name: string; reason: string }>
}

/** Check which ingredients are available. Returns null if pantry is unreachable. */
export async function checkIngredients(items: string[]): Promise<CheckResult | null> {
  try {
    return await lc.call<CheckResult>("pantry", {
      method: "POST",
      path: "/api/check",
      body: { items },
    })
  } catch {
    return null
  }
}

/** Get pricing for scaled ingredient quantities. Returns null if pantry is unreachable. */
export async function priceIngredients(
  items: Array<{ name: string; quantity: number; unit: string }>
): Promise<PriceResult | null> {
  try {
    return await lc.call<PriceResult>("pantry", {
      method: "POST",
      path: "/api/price-check",
      body: { items },
    })
  } catch {
    return null
  }
}

/** Fraction of ingredient names available in pantry (0-1). Null if pantry unreachable. */
export async function availabilityFraction(ingredientNames: string[]): Promise<number | null> {
  if (ingredientNames.length === 0) return 1
  const result = await checkIngredients(ingredientNames)
  if (!result) return null
  return result.available.length / ingredientNames.length
}
