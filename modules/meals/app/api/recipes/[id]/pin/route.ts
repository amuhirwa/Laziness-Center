import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { recipes } from "@/db/schema"
import { eq } from "drizzle-orm"

type Params = { params: Promise<{ id: string }> }

export async function POST(_: NextRequest, { params }: Params) {
  const { id } = await params
  await db.update(recipes).set({ isPinned: true }).where(eq(recipes.id, id))
  return new NextResponse(null, { status: 204 })
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params
  await db.update(recipes).set({ isPinned: false }).where(eq(recipes.id, id))
  return new NextResponse(null, { status: 204 })
}
