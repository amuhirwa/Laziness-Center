import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { inventory, purchases } from "@/db/schema"
import { lc } from "@/lib/sdk"
import { normalizeIngredient } from "@/lib/normalize"

const DEFAULT_USER = process.env.PANTRY_DEFAULT_USER ?? ""

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    items: Array<{ name: string; quantity: number; unit: string; unitPrice: number }>
    totalCost?: number
    currency?: string
    purchasedAt?: string
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "items required" }, { status: 400 })
  }

  const purchasedAt = body.purchasedAt ? new Date(body.purchasedAt) : new Date()

  // Insert purchase record
  const [purchase] = await db.insert(purchases).values({
    itemsJson: body.items,
    totalCost: body.totalCost != null ? String(body.totalCost) : null,
    currency: body.currency ?? "RWF",
    purchasedAt,
    userId: DEFAULT_USER,
  }).returning({ id: purchases.id })

  // Upsert inventory: add purchased quantities
  for (const item of body.items) {
    const norm = normalizeIngredient(item.name)
    await db.execute(
      `INSERT INTO inventory (name_normalized, name_display, quantity, unit)
       VALUES ('${norm}', '${item.name}', ${item.quantity}, '${item.unit}')
       ON CONFLICT (name_normalized) DO UPDATE SET
         quantity     = inventory.quantity + ${item.quantity},
         last_updated = NOW()`
    )
  }

  // Publish events
  const changedItems = body.items.map((i) => i.name)

  await lc.publish({
    event: "pantry.purchase.recorded",
    data: {
      purchaseId: purchase.id,
      items: body.items,
      totalCost: body.totalCost,
      currency: body.currency ?? "RWF",
      purchasedAt: purchasedAt.toISOString(),
    },
    transport: "stream",
  })

  await lc.publish({
    event: "pantry.inventory.changed",
    data: { changedItems },
    transport: "pubsub",
  })

  return NextResponse.json({ purchaseId: purchase.id }, { status: 201 })
}
