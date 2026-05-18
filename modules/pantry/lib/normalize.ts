/**
 * Normalize an ingredient name for inventory matching.
 * Strips cooking descriptors so "melted butter" → "butter",
 * "warm milk" → "milk", "all-purpose flour" → "flour", etc.
 */

// Common adjectives / preparation states that precede the base ingredient
const STRIP_WORDS = new Set([
  // temperature / state
  "warm", "hot", "cold", "chilled", "frozen", "room-temperature", "room",
  "melted", "softened", "cooled",
  // preparation
  "diced", "chopped", "minced", "sliced", "grated", "shredded", "crushed",
  "ground", "mashed", "cooked", "fried", "baked", "boiled", "roasted",
  "toasted", "sifted", "beaten", "whipped", "peeled", "seeded", "trimmed",
  "rinsed", "drained", "packed", "loosely",
  // size
  "large", "medium", "small", "extra-large", "jumbo",
  // quality / form
  "fresh", "dried", "canned", "whole", "half", "plain", "pure",
  "unsalted", "salted", "unsweetened", "sweetened", "low-fat", "full-fat",
  "all-purpose", "all", "purpose", "heavy",
  // filler words that sneak in
  "temperature",
])

export function normalizeIngredient(name: string): string {
  const words = name.toLowerCase().trim().split(/[\s-]+/)
  // Drop descriptor words from the front until we hit the base ingredient
  let start = 0
  while (start < words.length - 1 && STRIP_WORDS.has(words[start])) {
    start++
  }
  const base = words.slice(start).join(" ")
  // Strip trailing 's' for basic pluralization (skip short words: "gas" → "ga" is wrong)
  if (base.endsWith("s") && base.length > 3 && !base.endsWith("ss")) {
    return base.slice(0, -1)
  }
  return base
}

/**
 * Check whether a pantry item (already normalized) could satisfy an
 * ingredient name. Tries exact match first, then substring containment
 * so "butter" satisfies "melted butter" even after descriptor stripping.
 */
export function ingredientMatches(ingredientNorm: string, pantryNorm: string): boolean {
  if (ingredientNorm === pantryNorm) return true
  // pantry item is contained in the ingredient ("butter" in "melted butter")
  if (ingredientNorm.includes(pantryNorm)) return true
  // ingredient is contained in the pantry item (e.g. "milk" in "whole milk")
  if (pantryNorm.includes(ingredientNorm)) return true
  return false
}
