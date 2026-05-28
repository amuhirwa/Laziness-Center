import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { datePlans, places, checklists, checklistItems } from "@/db/schema"
import { asc, eq } from "drizzle-orm"
type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const [plan] = await db.select().from(datePlans).where(eq(datePlans.id, id))
  if (!plan) return NextResponse.json({ error: "not found" }, { status: 404 })

  const place = plan.placeId
    ? (await db.select().from(places).where(eq(places.id, plan.placeId)))[0] ?? null
    : null

  const checklist = plan.checklistId
    ? (await db.select().from(checklists).where(eq(checklists.id, plan.checklistId)))[0] ?? null
    : null

  const items = checklist
    ? await db.select().from(checklistItems).where(eq(checklistItems.checklistId, checklist.id)).orderBy(asc(checklistItems.position))
    : []

  return NextResponse.json({ plan, place, checklist, items })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await request.json() as {
    title?: string; date?: string; placeId?: string | null; checklistId?: string | null; notes?: string
  }
  const [row] = await db.update(datePlans)
    .set({
      ...(body.title != null && { title: body.title.trim() }),
      ...(body.date != null && { date: body.date }),
      ...(body.notes != null && { notes: body.notes.trim() || null }),
      ...("placeId" in body && { placeId: body.placeId ?? null }),
      ...("checklistId" in body && { checklistId: body.checklistId ?? null }),
      updatedAt: new Date(),
    })
    .where(eq(datePlans.id, id))
    .returning()

  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json(row)
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params
  await db.delete(datePlans).where(eq(datePlans.id, id))
  return NextResponse.json({ ok: true })
}
