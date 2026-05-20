import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { checklists, checklistItems } from "@/db/schema"
import { asc, eq } from "drizzle-orm"
import { getUserId } from "@/lib/identity"
import { logActivity } from "@/lib/activity"

type Params = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params
  const [checklist] = await db.select().from(checklists).where(eq(checklists.id, id))
  if (!checklist) return NextResponse.json({ error: "not found" }, { status: 404 })

  const items = await db.select().from(checklistItems)
    .where(eq(checklistItems.checklistId, id))
    .orderBy(asc(checklistItems.position), asc(checklistItems.createdAt))

  return NextResponse.json({ checklist, items })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await request.json() as {
    name?: string; description?: string; isPinned?: boolean; isArchived?: boolean
  }

  const patch: Partial<typeof checklists.$inferInsert> = { updatedAt: new Date() }
  if (body.name != null) patch.name = body.name.trim()
  if (body.description != null) patch.description = body.description.trim() || null
  if (body.isPinned != null) patch.isPinned = body.isPinned
  if (body.isArchived != null) {
    patch.isArchived = body.isArchived
    patch.archivedAt = body.isArchived ? new Date() : null
  }

  const [updated] = await db.update(checklists).set(patch).where(eq(checklists.id, id)).returning()
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 })

  if (body.isArchived) {
    const actor = getUserId(request.headers)
    await logActivity({ kind: "archived", section: "checklist", actor, itemId: id, itemTitle: updated.name })
  }
  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params
  await db.delete(checklists).where(eq(checklists.id, id))
  return new NextResponse(null, { status: 204 })
}
