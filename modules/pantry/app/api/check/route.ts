import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { inventory } from "@/db/schema"
import { eq } from "drizzle-orm"
import { lc } from "@/lib/sdk"
import { normalizeIngredient, ingredientMatches } from "@/lib/normalize"

export async function POST(request: NextRequest) {
  const result = await lc.verifyToken(request.headers.get("authorization") ?? "")
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 401 })

  const body = await request.json() as { items?: unknown; userId?: string }
  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: "items must be an array of strings" }, { status: 400 })
  }
  const items = body.items as string[]
  const userId = body.userId ?? ""

  const rows = await db.select().from(inventory).where(eq(inventory.userId, userId))

  // Separate in-stock from staples (always_available but currently empty)
  const inStockNorms = rows
    .filter((r) => parseFloat(r.quantity as string) > 0)
    .map((r) => r.nameNormalized)

  const staplesNorms = rows
    .filter((r) => r.alwaysAvailable && parseFloat(r.quantity as string) <= 0)
    .map((r) => r.nameNormalized)

  const available: string[] = []
  const staples: string[] = []
  const missing: string[] = []

  for (const name of items) {
    const norm = normalizeIngredient(name)
    if (inStockNorms.some((p) => ingredientMatches(norm, p))) {
      available.push(name)
    } else if (staplesNorms.some((p) => ingredientMatches(norm, p))) {
      staples.push(name)
    } else {
      missing.push(name)
    }
  }

  return NextResponse.json({ available, staples, missing, low: [] })
}
