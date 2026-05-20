import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { activity } from "@/db/schema"
import { desc, gte } from "drizzle-orm"
import { lc } from "@/lib/sdk"

const KIND_PAST: Record<string, string> = {
  added: "added",
  completed: "completed",
  reacted: "reacted to",
  "status-changed": "updated",
  commented: "commented on",
  visited: "visited",
  archived: "archived",
}

export async function GET(request: NextRequest) {
  const result = await lc.verifyToken(request.headers.get("authorization") ?? "")
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 401 })

  const weekAgo = new Date(Date.now() - 7 * 86400_000)
  const rows = await db.select().from(activity)
    .where(gte(activity.createdAt, weekAgo))
    .orderBy(desc(activity.createdAt))
    .limit(50)

  const count = rows.length
  if (count === 0) {
    return NextResponse.json({ title: "Us", primary: "Nothing yet", link: "/us" })
  }

  const latest = rows[0]
  const name = latest.actor.split("@")[0]
  const verb = KIND_PAST[latest.kind] ?? latest.kind
  const secondary = `${name} ${verb} ${latest.itemTitle ?? latest.section}`

  return NextResponse.json({
    title: "Us",
    primary: `${count} item${count !== 1 ? "s" : ""} this week`,
    secondary,
    link: "/us",
  })
}
