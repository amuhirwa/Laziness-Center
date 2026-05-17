/**
 * v0.1 unit conversion table — metric pairs only.
 * Non-metric conversions (oz↔g, cup↔ml) are intentionally absent.
 * Log mismatches; expand based on real usage data in v0.2.
 */
const CONVERSIONS: Record<string, { to: string; factor: number }> = {
  g:  { to: "kg", factor: 0.001 },
  kg: { to: "g",  factor: 1000  },
  ml: { to: "l",  factor: 0.001 },
  l:  { to: "ml", factor: 1000  },
}

/**
 * Convert `quantity` from `fromUnit` to `toUnit`.
 * Returns the converted quantity, or null if the conversion is not supported.
 */
export function convertUnit(quantity: number, fromUnit: string, toUnit: string): number | null {
  const from = fromUnit.toLowerCase()
  const to = toUnit.toLowerCase()
  if (from === to) return quantity
  const conv = CONVERSIONS[from]
  if (conv && conv.to === to) return quantity * conv.factor
  return null
}
