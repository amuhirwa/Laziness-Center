import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { inventory } from "@/db/schema"
import { eq } from "drizzle-orm"
import { lc } from "@/lib/sdk"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json() as { quantity?: number }
  if (body.quantity == null || typeof body.quantity !== "number") {
    return NextResponse.json({ error: "quantity required" }, { status: 400 })
  }

  const [updated] = await db
    .update(inventory)
    .set({ quantity: String(body.quantity), lastUpdated: new Date() })
    .where(eq(inventory.id, parseInt(id)))
    .returning()

  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 })

  await lc.publish({
    event: "pantry.inventory.changed",
    data: { changedItems: [updated.nameDisplay] },
    transport: "pubsub",
  })

  return NextResponse.json(updated)
}
