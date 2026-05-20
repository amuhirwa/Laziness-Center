import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { wishlistItems } from "@/db/schema"
import { getUserId } from "@/lib/identity"
import { scrapeOG } from "@/lib/og"
import { logActivity } from "@/lib/activity"

export async function POST(request: NextRequest) {
  const body = await request.json() as { url?: string }
  if (!body.url?.trim()) return NextResponse.json({ error: "url required" }, { status: 400 })

  const og = await scrapeOG(body.url)
  const actor = getUserId(request.headers)

  const [row] = await db.insert(wishlistItems).values({
    title: og.title ?? body.url,
    description: og.description,
    url: body.url,
    imageUrl: og.imageUrl,
    addedBy: actor,
  }).returning()

  const hadMeta = og.title !== null
  await logActivity({ kind: "added", section: "wishlist", actor, itemId: row.id, itemTitle: row.title })
  return NextResponse.json({ ...row, hadMeta }, { status: 201 })
}
