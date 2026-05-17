import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { cookSessions } from "@/db/schema"
import { and, eq } from "drizzle-orm"

const DEFAULT_USER = process.env.MEALS_DEFAULT_USER ?? ""

export async function POST(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await db
    .update(cookSessions)
    .set({ status: "cancelled" })
    .where(and(eq(cookSessions.id, id), eq(cookSessions.userId, DEFAULT_USER)))
  return new NextResponse(null, { status: 204 })
}
