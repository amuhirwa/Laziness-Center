import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { activity } from "@/db/schema"
import { and, desc, gte, sql } from "drizzle-orm"

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const since = sp.get("since")
  const limit = Math.min(parseInt(sp.get("limit") ?? "50"), 100)

  const cutoff = since ? new Date(since) : new Date(Date.now() - 30 * 86400_000)

  const rawRows = await db.select().from(activity)
    .where(gte(activity.createdAt, cutoff))
    .orderBy(desc(activity.createdAt))
    .limit(limit * 2) // fetch extra for coalescing

  // Read-time coalescing: same actor + kind + section within 10 minutes → collapse
  const coalesced: (typeof rawRows[0] & { count: number })[] = []
  const WINDOW_MS = 10 * 60 * 1000

  for (const row of rawRows) {
    const last = coalesced[coalesced.length - 1]
    if (
      last &&
      last.actor === row.actor &&
      last.kind === row.kind &&
      last.section === row.section &&
      last.itemId === row.itemId &&
      Math.abs(last.createdAt!.getTime() - row.createdAt!.getTime()) < WINDOW_MS
    ) {
      last.count++
      last.meta = { ...(last.meta as object | null ?? {}), count: last.count }
    } else {
      coalesced.push({ ...row, count: 1 })
    }
  }

  return NextResponse.json({ entries: coalesced.slice(0, limit) })
}
