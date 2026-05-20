import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { checklists, checklistItems } from "@/db/schema"
import { eq, max } from "drizzle-orm"
import { getUserId } from "@/lib/identity"

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params
  const [checklist] = await db.select({ id: checklists.id }).from(checklists).where(eq(checklists.id, id))
  if (!checklist) return NextResponse.json({ error: "not found" }, { status: 404 })

  const body = await request.json() as { text?: string; notes?: string; dueDate?: string }
  if (!body.text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 })

  // Append at end
  const [{ maxPos }] = await db.select({ maxPos: max(checklistItems.position) })
    .from(checklistItems)
    .where(eq(checklistItems.checklistId, id))
  const position = (maxPos ?? -1) + 1

  const actor = getUserId(request.headers)
  const [item] = await db.insert(checklistItems).values({
    checklistId: id,
    text: body.text.trim(),
    notes: body.notes?.trim() ?? null,
    dueDate: body.dueDate ? new Date(body.dueDate) : null,
    position,
    addedBy: actor,
  }).returning()

  // Touch parent updatedAt
  await db.update(checklists).set({ updatedAt: new Date() }).where(eq(checklists.id, id))

  return NextResponse.json(item, { status: 201 })
}
