import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { activities, reactions, comments } from "@/db/schema"
import { and, asc, eq } from "drizzle-orm"
import { getUserId } from "@/lib/identity"
import { logActivity } from "@/lib/activity"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const [item] = await db.select().from(activities).where(eq(activities.id, id))
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 })

  const reacts = await db.select().from(reactions)
    .where(and(eq(reactions.itemType, "activity"), eq(reactions.itemId, id)))
  const commentRows = await db.select().from(comments)
    .where(and(eq(comments.itemType, "activity"), eq(comments.itemId, id)))
    .orderBy(asc(comments.createdAt))

  return NextResponse.json({ item, reactions: reacts, comments: commentRows })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await request.json() as {
    title?: string; description?: string; category?: string
    status?: string; isPinned?: boolean
    linkedType?: string | null; linkedId?: string | null; linkedUrl?: string | null
  }
  const actor = getUserId(request.headers)
  const patch: Partial<typeof activities.$inferInsert> = { updatedAt: new Date() }

  if (body.title != null) patch.title = body.title.trim()
  if (body.description != null) patch.description = body.description.trim() || null
  if (body.category != null) patch.category = body.category
  if (body.isPinned != null) patch.isPinned = body.isPinned
  if ("linkedType" in body) patch.linkedType = body.linkedType ?? null
  if ("linkedId" in body) patch.linkedId = body.linkedId ?? null
  if ("linkedUrl" in body) patch.linkedUrl = body.linkedUrl ?? null
  if (body.status != null) {
    patch.status = body.status
    await logActivity({ kind: "status-changed", section: "activities", actor, itemId: id })
  }

  const [updated] = await db.update(activities).set(patch).where(eq(activities.id, id)).returning()
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params
  await db.delete(activities).where(eq(activities.id, id))
  return new NextResponse(null, { status: 204 })
}
