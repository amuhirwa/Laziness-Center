import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { checklists, checklistItems } from "@/db/schema"
import { asc, eq } from "drizzle-orm"
import { getUserId } from "@/lib/identity"

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params
  const [original] = await db.select().from(checklists).where(eq(checklists.id, id))
  if (!original) return NextResponse.json({ error: "not found" }, { status: 404 })

  const actor = getUserId(request.headers)
  const items = await db.select().from(checklistItems)
    .where(eq(checklistItems.checklistId, id))
    .orderBy(asc(checklistItems.position))

  const [newChecklist] = await db.insert(checklists).values({
    name: `${original.name} (copy)`,
    description: original.description,
    createdBy: actor,
  }).returning()

  if (items.length > 0) {
    await db.insert(checklistItems).values(
      items.map((item) => ({
        checklistId: newChecklist.id,
        text: item.text,
        notes: item.notes,
        position: item.position,
        addedBy: actor,
      }))
    )
  }

  return NextResponse.json(newChecklist, { status: 201 })
}
