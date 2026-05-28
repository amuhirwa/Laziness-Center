import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { turns, activity } from "@/db/schema"
import { desc, eq } from "drizzle-orm"
import { getUserId } from "@/lib/identity"

type Params = { params: Promise<{ category: string }> }

const VALID = new Set(["checklists", "wishlists", "places", "activities"])

export async function GET(_request: NextRequest, { params }: Params) {
  const { category } = await params
  if (!VALID.has(category)) return NextResponse.json({ error: "invalid category" }, { status: 400 })

  const [row] = await db.select().from(turns).where(eq(turns.category, category))
  if (!row) return NextResponse.json({ currentUserId: null })

  return NextResponse.json({
    category: row.category,
    currentUserId: row.currentUserId,
    currentUserName: row.currentUserId.split("@")[0],
  })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { category } = await params
  if (!VALID.has(category)) return NextResponse.json({ error: "invalid category" }, { status: 400 })

  const actor = getUserId(request.headers)

  // Find the two distinct recent actors to determine the other user
  const recent = await db.select({ actor: activity.actor })
    .from(activity).orderBy(desc(activity.createdAt)).limit(50)

  const distinctActors = [...new Set(recent.map((r) => r.actor))].filter((a) => a !== "guest@lovey.tv")
  const other = distinctActors.find((a) => a !== actor) ?? actor

  const [existing] = await db.select().from(turns).where(eq(turns.category, category))
  let next: string

  if (!existing) {
    // First time — give the turn to the other user
    next = other
  } else {
    // Flip to whoever isn't current
    next = existing.currentUserId === actor ? other : actor
  }

  const [row] = await db.insert(turns)
    .values({ category, currentUserId: next })
    .onConflictDoUpdate({
      target: turns.category,
      set: { currentUserId: next, updatedAt: new Date() },
    })
    .returning()

  return NextResponse.json({ category: row.category, currentUserId: row.currentUserId, currentUserName: row.currentUserId.split("@")[0] })
}
