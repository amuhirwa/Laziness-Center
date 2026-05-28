import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { decisionHistory } from "@/db/schema"
import { desc } from "drizzle-orm"
import { getUserId } from "@/lib/identity"
import { logActivity } from "@/lib/activity"

export const dynamic = "force-dynamic"

export async function GET() {
  const rows = await db.select().from(decisionHistory)
    .orderBy(desc(decisionHistory.decidedAt))
    .limit(50)

  return NextResponse.json({ decisions: rows })
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    mode: string
    winnerTitle: string
    winnerType?: string
    winnerId?: string
    candidates: unknown[]
    votes?: unknown
  }

  if (!body.winnerTitle || !body.mode) {
    return NextResponse.json({ error: "mode and winnerTitle required" }, { status: 400 })
  }

  const actor = getUserId(request.headers)
  const [row] = await db.insert(decisionHistory).values({
    mode: body.mode,
    winnerTitle: body.winnerTitle,
    winnerType: body.winnerType ?? null,
    winnerId: body.winnerId ?? null,
    candidates: body.candidates as object[],
    votes: body.votes ? (body.votes as object) : null,
    decidedBy: actor,
  }).returning()

  await logActivity({ kind: "decide", section: "decide", actor, itemTitle: body.winnerTitle })
  return NextResponse.json(row, { status: 201 })
}
