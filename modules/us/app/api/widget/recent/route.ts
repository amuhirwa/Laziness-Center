import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { activity, datePlans, places } from "@/db/schema"
import { asc, desc, eq, gte, lte, and } from "drizzle-orm"
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

  // Check for an upcoming plan within 3 days
  const today = new Date().toISOString().slice(0, 10)
  const threeDays = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10)
  const upcomingPlans = await db.select().from(datePlans)
    .where(and(gte(datePlans.date, today), lte(datePlans.date, threeDays)))
    .orderBy(asc(datePlans.date))
    .limit(1)

  if (upcomingPlans.length > 0) {
    const plan = upcomingPlans[0]
    const daysUntil = Math.round((new Date(plan.date).getTime() - new Date().setHours(0,0,0,0)) / 86400_000)
    const placeLabel = plan.placeId
      ? ((await db.select({ name: places.name }).from(places).where(eq(places.id, plan.placeId)))[0]?.name ?? null)
      : null
    const when = daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`
    return NextResponse.json({
      title: "Us",
      primary: plan.title,
      secondary: `${placeLabel ? `📍 ${placeLabel} · ` : ""}${when}`,
      link: `/us/plans/${plan.id}`,
    })
  }

  const weekAgo = new Date(Date.now() - 7 * 86400_000)
  const rows = await db.select().from(activity)
    .where(gte(activity.createdAt, weekAgo))
    .orderBy(desc(activity.createdAt))
    .limit(50)

  const actCount = rows.length
  if (actCount === 0) {
    return NextResponse.json({ title: "Us", primary: "Nothing yet", link: "/us" })
  }

  const latest = rows[0]
  const name = latest.actor.split("@")[0]
  const verb = KIND_PAST[latest.kind] ?? latest.kind
  const secondary = `${name} ${verb} ${latest.itemTitle ?? latest.section}`

  return NextResponse.json({
    title: "Us",
    primary: `${actCount} item${actCount !== 1 ? "s" : ""} this week`,
    secondary,
    link: "/us",
  })
}
