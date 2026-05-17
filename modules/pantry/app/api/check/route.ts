import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { inventory } from "@/db/schema"
import { inArray } from "drizzle-orm"
import { lc } from "@/lib/sdk"
import { normalizeIngredient } from "@/lib/normalize"

export async function POST(request: NextRequest) {
  const result = await lc.verifyToken(request.headers.get("authorization") ?? "")
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 401 })

  const body = await request.json() as { items?: unknown }
  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: "items must be an array of strings" }, { status: 400 })
  }
  const items = body.items as string[]

  // Build normalized→original map
  const nameMap = new Map<string, string>(items.map((name) => [normalizeIngredient(name), name]))
  const normalizedNames = [...nameMap.keys()]

  const rows = await db
    .select()
    .from(inventory)
    .where(inArray(inventory.nameNormalized, normalizedNames))

  // Items with quantity > 0 are available
  const available: string[] = []
  const missing: string[] = []
  const availableNorm = new Set(
    rows.filter((r) => parseFloat(r.quantity as string) > 0).map((r) => r.nameNormalized)
  )

  for (const [norm, original] of nameMap) {
    if (availableNorm.has(norm)) available.push(original)
    else missing.push(original)
  }

  return NextResponse.json({ available, missing, low: [] })
}
