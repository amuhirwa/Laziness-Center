import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { placeVisits, places } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getUserId } from "@/lib/identity"
import { logActivity } from "@/lib/activity"

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await request.json() as { visitedAt?: string; rating?: number; notes?: string }

  const actor = getUserId(request.headers)
  const [row] = await db.insert(placeVisits).values({
    placeId: id,
    visitedAt: body.visitedAt ? new Date(body.visitedAt) : new Date(),
    rating: body.rating ?? null,
    notes: body.notes?.trim() ?? null,
    loggedBy: actor,
  }).returning()

  // Mark place as visited
  const [place] = await db.update(places)
    .set({ status: "visited", updatedAt: new Date() })
    .where(eq(places.id, id))
    .returning({ name: places.name })

  await logActivity({ kind: "visited", section: "places", actor, itemId: id, itemTitle: place?.name })
  return NextResponse.json(row, { status: 201 })
}
