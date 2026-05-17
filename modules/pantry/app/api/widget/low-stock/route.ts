import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { inventory } from "@/db/schema"
import { desc } from "drizzle-orm"
import { lc } from "@/lib/sdk"

export async function GET(request: NextRequest) {
  const result = await lc.verifyToken(request.headers.get("authorization") ?? "")
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 401 })

  const rows = await db.select().from(inventory).orderBy(desc(inventory.lastUpdated))
  const count = rows.length

  if (count === 0) {
    return NextResponse.json({ title: "Pantry", primary: "Empty", link: "/pantry" })
  }

  const lastUpdated = rows[0]?.lastUpdated
  const dayAgo = new Date(Date.now() - 86400_000)
  const secondaryText = lastUpdated && lastUpdated > dayAgo
    ? "last updated today"
    : lastUpdated
      ? `last updated ${lastUpdated.toLocaleDateString()}`
      : "no updates yet"

  return NextResponse.json({
    title: "Pantry",
    primary: `${count} item${count !== 1 ? "s" : ""}`,
    secondary: secondaryText,
    link: "/pantry",
  })
}
