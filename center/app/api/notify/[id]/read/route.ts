import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/db"
import { notifications } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function POST(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })

  const { id } = await params
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(eq(notifications.id, id))

  return new NextResponse(null, { status: 204 })
}
