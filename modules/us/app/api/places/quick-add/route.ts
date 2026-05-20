import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { places } from "@/db/schema"
import { getUserId } from "@/lib/identity"
import { scrapeOG } from "@/lib/og"
import { logActivity } from "@/lib/activity"

function parseGoogleMapsName(url: string): string | null {
  try {
    const u = new URL(url)
    // /maps/place/Name/... or ?q=Name
    const placeMatch = u.pathname.match(/\/maps\/place\/([^/]+)/)
    if (placeMatch) return decodeURIComponent(placeMatch[1].replace(/\+/g, " "))
    const q = u.searchParams.get("q")
    if (q) return q
  } catch { /* ignore */ }
  return null
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { url?: string }
  if (!body.url?.trim()) return NextResponse.json({ error: "url required" }, { status: 400 })

  const isGoogleMaps = body.url.includes("google.com/maps") || body.url.includes("maps.app.goo.gl")
  const actor = getUserId(request.headers)

  let name = isGoogleMaps ? (parseGoogleMapsName(body.url) ?? body.url) : null
  let imageUrl: string | null = null

  if (!isGoogleMaps) {
    const og = await scrapeOG(body.url)
    name = og.title ?? body.url
    imageUrl = og.imageUrl
  }

  const [row] = await db.insert(places).values({
    name: name ?? body.url,
    url: body.url,
    imageUrl,
    addedBy: actor,
  }).returning()

  await logActivity({ kind: "added", section: "places", actor, itemId: row.id, itemTitle: row.name })
  return NextResponse.json(row, { status: 201 })
}
