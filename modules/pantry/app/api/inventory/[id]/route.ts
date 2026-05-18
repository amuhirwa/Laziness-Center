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
  const body = await request.json() as { quantity?: number; alwaysAvailable?: boolean }

  const patch: Partial<typeof inventory.$inferInsert> = { lastUpdated: new Date() }
  if (body.quantity != null) patch.quantity = String(body.quantity)
  if (body.alwaysAvailable != null) patch.alwaysAvailable = body.alwaysAvailable

  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: "quantity or alwaysAvailable required" }, { status: 400 })
  }

  const [updated] = await db
    .update(inventory)
    .set(patch)
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
