import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { places } from "@/db/schema"
import { desc, eq } from "drizzle-orm"
import { getUserId } from "@/lib/identity"
import { logActivity } from "@/lib/activity"
import { scrapeOG } from "@/lib/og"

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const status = sp.get("status") ?? "wantToGo"
  const category = sp.get("category")

  let rows = status === "all"
    ? await db.select().from(places).orderBy(desc(places.isPinned), desc(places.createdAt))
    : await db.select().from(places).where(eq(places.status, status)).orderBy(desc(places.isPinned), desc(places.createdAt))

  if (category) rows = rows.filter((r) => r.category === category)
  return NextResponse.json({ places: rows })
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    name?: string; location?: string; description?: string; url?: string
    imageUrl?: string; category?: string
  }
  if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 })

  const actor = getUserId(request.headers)
  const [row] = await db.insert(places).values({
    name: body.name.trim(),
    location: body.location?.trim() ?? null,
    description: body.description?.trim() ?? null,
    url: body.url ?? null,
    imageUrl: body.imageUrl ?? null,
    category: body.category ?? null,
    addedBy: actor,
  }).returning()

  await logActivity({ kind: "added", section: "places", actor, itemId: row.id, itemTitle: row.name })
  return NextResponse.json(row, { status: 201 })
}
