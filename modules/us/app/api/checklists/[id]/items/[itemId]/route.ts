import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { checklists, checklistItems } from "@/db/schema"
import { and, eq, gte, lt, sql } from "drizzle-orm"
import { getUserId } from "@/lib/identity"
import { logActivity } from "@/lib/activity"

type Params = { params: Promise<{ id: string; itemId: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id, itemId } = await params
  const body = await request.json() as {
    text?: string; notes?: string; completed?: boolean; dueDate?: string | null
  }

  const actor = getUserId(request.headers)
  const patch: Partial<typeof checklistItems.$inferInsert> = {}

  if (body.text != null) patch.text = body.text.trim()
  if (body.notes != null) patch.notes = body.notes.trim() || null
  if (body.dueDate !== undefined) patch.dueDate = body.dueDate ? new Date(body.dueDate) : null
  if (body.completed != null) {
    patch.completed = body.completed
    patch.completedAt = body.completed ? new Date() : null
    patch.completedBy = body.completed ? actor : null
  }

  const [updated] = await db.update(checklistItems).set(patch)
    .where(and(eq(checklistItems.id, itemId), eq(checklistItems.checklistId, id)))
    .returning()

  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 })

  if (body.completed) {
    const [cl] = await db.select({ name: checklists.name }).from(checklists).where(eq(checklists.id, id))
    await logActivity({
      kind: "completed", section: "checklist", actor,
      itemId, itemTitle: updated.text,
      meta: { checklistName: cl?.name },
    })
  }

  await db.update(checklists).set({ updatedAt: new Date() }).where(eq(checklists.id, id))
  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id, itemId } = await params
  await db.delete(checklistItems)
    .where(and(eq(checklistItems.id, itemId), eq(checklistItems.checklistId, id)))
  await db.update(checklists).set({ updatedAt: new Date() }).where(eq(checklists.id, id))
  return new NextResponse(null, { status: 204 })
}
