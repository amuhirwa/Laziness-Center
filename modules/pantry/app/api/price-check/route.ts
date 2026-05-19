import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { purchases } from "@/db/schema"
import { desc, eq } from "drizzle-orm"
import { lc } from "@/lib/sdk"
import { normalizeIngredient } from "@/lib/normalize"
import { convertUnit } from "@/lib/units"

type RequestItem = { name: string; quantity: number; unit: string }

export async function POST(request: NextRequest) {
  const result = await lc.verifyToken(request.headers.get("authorization") ?? "")
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 401 })

  const body = await request.json() as { items?: unknown; userId?: string }
  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: "items must be an array" }, { status: 400 })
  }
  const items = body.items as RequestItem[]
  const userId = body.userId ?? ""

  // Fetch this user's purchases sorted by most recent — scan per item for unit price
  const allPurchases = await db.select().from(purchases)
    .where(eq(purchases.userId, userId))
    .orderBy(desc(purchases.purchasedAt))

  const priced: Array<{
    name: string; totalCost: number; currency: string
    unitPrice: number; unitPriceUnit: string; basedOnPurchaseAt: string
  }> = []
  const unpriced: Array<{ name: string; reason: string }> = []

  for (const item of items) {
    const norm = normalizeIngredient(item.name)
    let found = false

    for (const purchase of allPurchases) {
      const purchaseItems = purchase.itemsJson as Array<{
        name: string; quantity: number; unit: string; unitPrice: number
      }>
      const match = purchaseItems.find((pi) => normalizeIngredient(pi.name) === norm)
      if (!match) continue

      const converted = convertUnit(item.quantity, item.unit, match.unit)
      if (converted === null) {
        unpriced.push({ name: item.name, reason: `unit mismatch — requested: ${item.unit}, purchased: ${match.unit}` })
        found = true
        break
      }

      priced.push({
        name: item.name,
        totalCost: Math.round(match.unitPrice * converted * 100) / 100,
        currency: purchase.currency,
        unitPrice: match.unitPrice,
        unitPriceUnit: match.unit,
        basedOnPurchaseAt: purchase.purchasedAt.toISOString(),
      })
      found = true
      break
    }

    if (!found) {
      unpriced.push({ name: item.name, reason: "no purchase history" })
    }
  }

  return NextResponse.json({ priced, unpriced })
}
