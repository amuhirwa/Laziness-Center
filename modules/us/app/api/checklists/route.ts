import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { checklists } from "@/db/schema"
import { and, asc, desc, eq } from "drizzle-orm"
import { getUserId } from "@/lib/identity"
import { logActivity } from "@/lib/activity"

export async function GET(request: NextRequest) {
  const archived = request.nextUrl.searchParams.get("archived") === "true"

  const rows = await db.select().from(checklists)
    .where(eq(checklists.isArchived, archived))
    .orderBy(desc(checklists.isPinned), desc(checklists.updatedAt))

  return NextResponse.json({ checklists: rows })
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { name?: string; description?: string }
  if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 })

  const actor = getUserId(request.headers)
  const [row] = await db.insert(checklists).values({
    name: body.name.trim(),
    description: body.description?.trim() ?? null,
    createdBy: actor,
  }).returning()

  await logActivity({ kind: "added", section: "checklist", actor, itemId: row.id, itemTitle: row.name })
  return NextResponse.json(row, { status: 201 })
}
