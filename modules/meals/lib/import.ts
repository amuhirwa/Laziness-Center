/**
 * URL import — fetches a recipe page and parses schema.org Recipe JSON-LD.
 * Returns a pre-filled (unsaved) recipe object for user review.
 * Handles HowToStep array, string array, and single string instruction shapes.
 * Does NOT auto-split blob instructions — let the user restructure manually.
 */
import type { Ingredient, Step } from "@/db/schema"

export type ImportedRecipe = {
  name: string
  servingsDefault?: number
  timeMinutes?: number
  ingredients?: Ingredient[]
  steps?: Step[]
  hasStructuredSteps?: boolean
  tags?: string[]
  sourceUrl: string
}

type ImportResult =
  | { success: true; recipe: ImportedRecipe }
  | { success: false; error: string; pageTitle: string | null }

function parseIso8601Minutes(duration: string): number | undefined {
  const m = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (!m) return undefined
  return (parseInt(m[1] ?? "0") * 60) + parseInt(m[2] ?? "0")
}

function parseIngredient(raw: string): Ingredient {
  // Best-effort: "200 g flour" → { quantity: 200, unit: "g", name: "flour" }
  const m = raw.trim().match(/^([\d¼½¾⅓⅔⅛⅜⅝⅞.,/]+)\s*([a-zA-Z]+)?\s+(.+)$/)
  if (m) {
    const qty = parseFloat(m[1].replace(",", "."))
    return { name: m[3].trim(), quantity: isNaN(qty) ? null : qty, unit: m[2] ?? null }
  }
  return { name: raw.trim(), quantity: null, unit: null }
}

export async function importFromUrl(url: string): Promise<ImportResult> {
  let html: string
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
      },
    })
    if (!res.ok) {
      const blocked = res.status === 403 || res.status === 429
      return {
        success: false,
        error: blocked
          ? `${res.status} — site blocks server-side requests (Cloudflare/bot protection). Use a site without bot protection, or add the recipe manually`
          : `URL returned ${res.status}`,
        pageTitle: null,
      }
    }
    html = await res.text()
  } catch (e) {
    return { success: false, error: String(e), pageTitle: null }
  }

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const pageTitle = titleMatch ? titleMatch[1].trim() : null

  // Extract all JSON-LD blocks
  const blocks: string[] = []
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) blocks.push(m[1])

  let ld: Record<string, unknown> | null = null
  for (const block of blocks) {
    try {
      const parsed: unknown = JSON.parse(block)
      const candidates = Array.isArray(parsed)
        ? parsed
        : (parsed as Record<string, unknown>)["@graph"]
          ? ((parsed as Record<string, unknown>)["@graph"] as unknown[])
          : [parsed]
      for (const item of candidates) {
        const type = (item as Record<string, unknown>)["@type"]
        const types = Array.isArray(type) ? type : [type]
        if (types.includes("Recipe")) { ld = item as Record<string, unknown>; break }
      }
    } catch { /* skip */ }
    if (ld) break
  }

  if (!ld) return { success: false, error: "No schema.org Recipe found on this page", pageTitle }

  const recipe: ImportedRecipe = { name: (ld.name as string) ?? pageTitle ?? "", sourceUrl: url }

  // Servings
  const yld = ld.recipeYield
  if (yld) {
    const str = Array.isArray(yld) ? String(yld[0]) : String(yld)
    const n = parseInt(str)
    if (!isNaN(n)) recipe.servingsDefault = n
  }

  // Time
  const timeStr = (ld.totalTime ?? ld.cookTime) as string | undefined
  if (timeStr) {
    const mins = parseIso8601Minutes(timeStr)
    if (mins && mins > 0) recipe.timeMinutes = mins
  }

  // Ingredients
  const rawIngs = ld.recipeIngredient
  if (Array.isArray(rawIngs)) {
    recipe.ingredients = (rawIngs as string[]).map(parseIngredient)
  }

  // Instructions
  const instr = ld.recipeInstructions
  if (typeof instr === "string") {
    recipe.steps = [{ text: instr }]
    recipe.hasStructuredSteps = false
  } else if (Array.isArray(instr) && instr.length > 0) {
    if (typeof instr[0] === "string") {
      recipe.steps = (instr as string[]).map((text) => ({ text }))
      recipe.hasStructuredSteps = instr.length > 1
    } else {
      // HowToStep objects
      type HowToStep = { "@type"?: string; text?: string; name?: string }
      const steps: Step[] = (instr as HowToStep[])
        .filter((s) => s.text || s.name)
        .map((s) => ({ text: s.text ?? s.name ?? "" }))
      recipe.steps = steps
      recipe.hasStructuredSteps = steps.length > 1
    }
  }

  // Tags from cuisine/category
  const tags: string[] = []
  const addTags = (v: unknown) => {
    const arr = Array.isArray(v) ? v as string[] : [v as string]
    tags.push(...arr.filter(Boolean).map((s) => s.toLowerCase()))
  }
  if (ld.recipeCuisine) addTags(ld.recipeCuisine)
  if (ld.recipeCategory) addTags(ld.recipeCategory)
  if (tags.length) recipe.tags = tags

  return { success: true, recipe }
}
