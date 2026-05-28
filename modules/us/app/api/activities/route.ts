import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { activities } from "@/db/schema"
import { desc, eq } from "drizzle-orm"
import { getUserId } from "@/lib/identity"
import { logActivity } from "@/lib/activity"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status") ?? "wantToDo"
  const rows = status === "all"
    ? await db.select().from(activities).orderBy(desc(activities.isPinned), desc(activities.createdAt))
    : await db.select().from(activities)
        .where(eq(activities.status, status))
        .orderBy(desc(activities.isPinned), desc(activities.createdAt))

  return NextResponse.json({ activities: rows })
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    title?: string; description?: string; category?: string
    linkedType?: string; linkedId?: string; linkedUrl?: string
  }
  if (!body.title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 })

  const actor = getUserId(request.headers)
  const [row] = await db.insert(activities).values({
    title: body.title.trim(),
    description: body.description?.trim() ?? null,
    category: body.category ?? null,
    linkedType: body.linkedType ?? null,
    linkedId: body.linkedId ?? null,
    linkedUrl: body.linkedUrl ?? null,
    addedBy: actor,
  }).returning()

  await logActivity({ kind: "added", section: "activities", actor, itemId: row.id, itemTitle: row.title })
  return NextResponse.json(row, { status: 201 })
}
