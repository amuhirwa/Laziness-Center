import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { comments } from "@/db/schema"
import { and, asc, eq } from "drizzle-orm"
import { getUserId } from "@/lib/identity"

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const itemType = sp.get("itemType")
  const itemId = sp.get("itemId")
  if (!itemType || !itemId) return NextResponse.json({ error: "itemType and itemId required" }, { status: 400 })

  const rows = await db.select().from(comments)
    .where(and(eq(comments.itemType, itemType), eq(comments.itemId, itemId)))
    .orderBy(asc(comments.createdAt))

  return NextResponse.json({ comments: rows })
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { itemType?: string; itemId?: string; body?: string }
  if (!body.itemType || !body.itemId || !body.body?.trim()) {
    return NextResponse.json({ error: "itemType, itemId, body required" }, { status: 400 })
  }

  const author = getUserId(request.headers)
  const [row] = await db.insert(comments).values({
    itemType: body.itemType,
    itemId: body.itemId,
    body: body.body.trim(),
    author,
  }).returning()

  return NextResponse.json(row, { status: 201 })
}
