import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { datePlans } from "@/db/schema"
import { asc, desc } from "drizzle-orm"
import { getUserId } from "@/lib/identity"
import { logActivity } from "@/lib/activity"

export const dynamic = "force-dynamic"

export async function GET() {
  const rows = await db.select().from(datePlans).orderBy(asc(datePlans.date))
  return NextResponse.json({ plans: rows })
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    title?: string; date?: string; placeId?: string; checklistId?: string; notes?: string
  }
  if (!body.title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 })
  if (!body.date) return NextResponse.json({ error: "date required" }, { status: 400 })

  const actor = getUserId(request.headers)
  const [row] = await db.insert(datePlans).values({
    title: body.title.trim(),
    date: body.date,
    placeId: body.placeId ?? null,
    checklistId: body.checklistId ?? null,
    notes: body.notes?.trim() ?? null,
    createdBy: actor,
  }).returning()

  await logActivity({ kind: "added", section: "plans", actor, itemId: row.id, itemTitle: row.title })
  return NextResponse.json(row, { status: 201 })
}
