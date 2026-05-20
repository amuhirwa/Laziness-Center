import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { comments } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { getUserId } from "@/lib/identity"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await request.json() as { body?: string }
  if (!body.body?.trim()) return NextResponse.json({ error: "body required" }, { status: 400 })

  const author = getUserId(request.headers)
  const [updated] = await db.update(comments)
    .set({ body: body.body.trim(), updatedAt: new Date() })
    .where(and(eq(comments.id, id), eq(comments.author, author)))
    .returning()

  if (!updated) return NextResponse.json({ error: "not found or not yours" }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params
  const author = getUserId(request.headers)
  await db.delete(comments).where(and(eq(comments.id, id), eq(comments.author, author)))
  return new NextResponse(null, { status: 204 })
}
