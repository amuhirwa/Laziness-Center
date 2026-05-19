import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { cookSessions } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { getUserId } from "@/lib/identity"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await db
    .update(cookSessions)
    .set({ status: "cancelled" })
    .where(and(eq(cookSessions.id, id), eq(cookSessions.userId, getUserId(request.headers))))
  return new NextResponse(null, { status: 204 })
}
