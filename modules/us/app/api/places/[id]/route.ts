import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { places, placeVisits, reactions, comments } from "@/db/schema"
import { and, asc, desc, eq } from "drizzle-orm"
import { getUserId } from "@/lib/identity"
import { logActivity } from "@/lib/activity"

type Params = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params
  const [place] = await db.select().from(places).where(eq(places.id, id))
  if (!place) return NextResponse.json({ error: "not found" }, { status: 404 })

  const visits = await db.select().from(placeVisits).where(eq(placeVisits.placeId, id)).orderBy(desc(placeVisits.visitedAt))
  const reacts = await db.select().from(reactions).where(and(eq(reactions.itemType, "place"), eq(reactions.itemId, id)))
  const commentRows = await db.select().from(comments)
    .where(and(eq(comments.itemType, "place"), eq(comments.itemId, id)))
    .orderBy(asc(comments.createdAt))

  return NextResponse.json({ place, visits, reactions: reacts, comments: commentRows })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await request.json() as {
    name?: string; location?: string; description?: string; url?: string
    imageUrl?: string; category?: string; status?: string; isPinned?: boolean
  }

  const actor = getUserId(request.headers)
  const patch: Partial<typeof places.$inferInsert> = { updatedAt: new Date() }
  if (body.name != null) patch.name = body.name.trim()
  if (body.location != null) patch.location = body.location.trim() || null
  if (body.description != null) patch.description = body.description.trim() || null
  if (body.url != null) patch.url = body.url
  if (body.imageUrl != null) patch.imageUrl = body.imageUrl
  if (body.category != null) patch.category = body.category
  if (body.isPinned != null) patch.isPinned = body.isPinned
  if (body.status != null) {
    const [before] = await db.select({ status: places.status }).from(places).where(eq(places.id, id))
    patch.status = body.status
    await logActivity({
      kind: "status-changed", section: "places", actor, itemId: id,
      meta: { oldStatus: before?.status, newStatus: body.status },
    })
  }

  const [updated] = await db.update(places).set(patch).where(eq(places.id, id)).returning()
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params
  await db.delete(places).where(eq(places.id, id))
  return new NextResponse(null, { status: 204 })
}
