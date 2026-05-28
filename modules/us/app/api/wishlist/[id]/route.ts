import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { wishlistItems, reactions, comments } from "@/db/schema"
import { and, asc, eq } from "drizzle-orm"
import { getUserId } from "@/lib/identity"
import { logActivity } from "@/lib/activity"

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params
  const actor = getUserId(request.headers)
  const [item] = await db.select().from(wishlistItems).where(eq(wishlistItems.id, id))
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 })
  // Hidden from this user
  if (item.hiddenFrom && item.hiddenFrom === actor) return NextResponse.json({ error: "not found" }, { status: 404 })

  const reacts = await db.select().from(reactions)
    .where(and(eq(reactions.itemType, "wishlist"), eq(reactions.itemId, id)))
  const commentRows = await db.select().from(comments)
    .where(and(eq(comments.itemType, "wishlist"), eq(comments.itemId, id)))
    .orderBy(asc(comments.createdAt))

  return NextResponse.json({ item, reactions: reacts, comments: commentRows })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await request.json() as {
    title?: string; description?: string; url?: string; imageUrl?: string
    price?: number; currency?: string; category?: string; status?: string; isPinned?: boolean
    hiddenFrom?: string | null
  }

  const actor = getUserId(request.headers)
  const patch: Partial<typeof wishlistItems.$inferInsert> = { updatedAt: new Date() }
  if (body.title != null) patch.title = body.title.trim()
  if (body.description != null) patch.description = body.description.trim() || null
  if (body.url != null) patch.url = body.url
  if (body.imageUrl != null) patch.imageUrl = body.imageUrl
  if (body.price != null) patch.price = String(body.price)
  if (body.currency != null) patch.currency = body.currency
  if (body.category != null) patch.category = body.category
  if (body.isPinned != null) patch.isPinned = body.isPinned
  if ("hiddenFrom" in body) patch.hiddenFrom = body.hiddenFrom ?? null
  if (body.status != null) {
    const [before] = await db.select({ status: wishlistItems.status }).from(wishlistItems).where(eq(wishlistItems.id, id))
    patch.status = body.status
    patch.statusChangedBy = actor
    patch.statusChangedAt = new Date()
    await logActivity({
      kind: "status-changed", section: "wishlist", actor, itemId: id,
      meta: { oldStatus: before?.status, newStatus: body.status },
    })
  }

  const [updated] = await db.update(wishlistItems).set(patch).where(eq(wishlistItems.id, id)).returning()
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params
  await db.delete(wishlistItems).where(eq(wishlistItems.id, id))
  return new NextResponse(null, { status: 204 })
}
