import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { inventory } from "@/db/schema"
import { lc } from "@/lib/sdk"
import { normalizeIngredient, ingredientMatches } from "@/lib/normalize"

export async function POST(request: NextRequest) {
  const result = await lc.verifyToken(request.headers.get("authorization") ?? "")
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 401 })

  const body = await request.json() as { items?: unknown }
  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: "items must be an array of strings" }, { status: 400 })
  }
  const items = body.items as string[]

  // Fetch all pantry items with stock > 0
  const rows = await db.select().from(inventory)
  const inStock = rows
    .filter((r) => parseFloat(r.quantity as string) > 0)
    .map((r) => r.nameNormalized)

  const available: string[] = []
  const missing: string[] = []

  for (const name of items) {
    const norm = normalizeIngredient(name)
    const found = inStock.some((pantryNorm) => ingredientMatches(norm, pantryNorm))
    if (found) available.push(name)
    else missing.push(name)
  }

  return NextResponse.json({ available, missing, low: [] })
}
