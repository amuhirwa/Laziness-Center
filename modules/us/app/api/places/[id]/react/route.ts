import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { reactions, places } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { getUserId } from "@/lib/identity"
import { logActivity } from "@/lib/activity"

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params
  const reactor = getUserId(request.headers)
  await db.insert(reactions).values({ itemType: "place", itemId: id, reactor }).onConflictDoNothing()
  const [place] = await db.select({ name: places.name }).from(places).where(eq(places.id, id))
  await logActivity({ kind: "reacted", section: "places", actor: reactor, itemId: id, itemTitle: place?.name })
  return new NextResponse(null, { status: 204 })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params
  const reactor = getUserId(request.headers)
  await db.delete(reactions).where(and(eq(reactions.itemType, "place"), eq(reactions.itemId, id), eq(reactions.reactor, reactor)))
  return new NextResponse(null, { status: 204 })
}
