import { NextRequest, NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/db"
import { inventory, purchases } from "@/db/schema"
import { lc } from "@/lib/sdk"
import { normalizeIngredient } from "@/lib/normalize"
import { getUserId } from "@/lib/identity"

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
  const userId = getUserId(request.headers)

  // Insert purchase record
  const [purchase] = await db.insert(purchases).values({
    itemsJson: body.items,
    totalCost: body.totalCost != null ? String(body.totalCost) : null,
    currency: body.currency ?? "RWF",
    purchasedAt,
    userId,
  }).returning({ id: purchases.id })

  // Upsert inventory: create row or add to existing quantity (scoped to this user)
  for (const item of body.items) {
    const norm = normalizeIngredient(item.name)
    await db.insert(inventory).values({
      userId,
      nameNormalized: norm,
      nameDisplay: item.name,
      quantity: String(item.quantity),
      unit: item.unit,
    }).onConflictDoUpdate({
      target: [inventory.userId, inventory.nameNormalized],
      set: {
        quantity: sql`${inventory.quantity} + ${String(item.quantity)}`,
        lastUpdated: new Date(),
      },
    })
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
