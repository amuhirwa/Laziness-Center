/**
 * Normalize an ingredient name for matching.
 * Lowercase + strip trailing 's' (basic pluralization).
 * Known limitation: "scallions" ≠ "green onions". Alias table planned for v0.2.
 */
export function normalizeIngredient(name: string): string {
  const lower = name.toLowerCase().trim()
  // Strip trailing 's' only for words longer than 3 chars to avoid "gas" → "ga"
  if (lower.endsWith("s") && lower.length > 3) {
    return lower.slice(0, -1)
  }
  return lower
}
