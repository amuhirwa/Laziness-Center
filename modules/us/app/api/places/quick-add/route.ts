import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { places } from "@/db/schema"
import { getUserId } from "@/lib/identity"
import { scrapeOG } from "@/lib/og"
import { logActivity } from "@/lib/activity"

function parseGoogleMapsUrl(urlStr: string): { name: string | null; lat: number | null; lng: number | null; address: string | null } {
  try {
    const u = new URL(urlStr)
    const nameMatch = u.pathname.match(/\/maps\/place\/([^/]+)/)
    const name = nameMatch
      ? decodeURIComponent(nameMatch[1].replace(/\+/g, " "))
      : u.searchParams.get("q")

    const coordMatch = u.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    const lat = coordMatch ? parseFloat(coordMatch[1]) : null
    const lng = coordMatch ? parseFloat(coordMatch[2]) : null

    return { name, lat, lng, address: null }
  } catch {
    return { name: null, lat: null, lng: null, address: null }
  }
}

async function resolveShortLink(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(4000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LazinessCenter/1.0)" },
    })
    return res.url
  } catch {
    return url
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { url?: string }
  if (!body.url?.trim()) return NextResponse.json({ error: "url required" }, { status: 400 })

  let inputUrl = body.url.trim()
  const actor = getUserId(request.headers)

  const isGoogleMaps = inputUrl.includes("google.com/maps") || inputUrl.includes("maps.app.goo.gl")

  let name: string | null = null
  let imageUrl: string | null = null
  let lat: number | null = null
  let lng: number | null = null
  let address: string | null = null

  if (isGoogleMaps) {
    // Follow short-link redirects first
    if (inputUrl.includes("maps.app.goo.gl")) {
      inputUrl = await resolveShortLink(inputUrl)
    }

    const parsed = parseGoogleMapsUrl(inputUrl)
    name = parsed.name
    lat = parsed.lat
    lng = parsed.lng

    // Try OG scrape for an image (Maps sometimes returns a street view thumbnail)
    try {
      const og = await scrapeOG(inputUrl)
      if (og.imageUrl) imageUrl = og.imageUrl
    } catch { /* ignore */ }

    // If we have coordinates but no address, reverse-geocode via Nominatim
    if (lat !== null && lng !== null && !address) {
      try {
        const revUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
        const rev = await fetch(revUrl, {
          signal: AbortSignal.timeout(3000),
          headers: { "User-Agent": "LazinessCenter/1.0 (self-hosted personal app)" },
        })
        if (rev.ok) {
          const revData = await rev.json() as { display_name?: string; address?: { road?: string; city?: string; country?: string } }
          if (revData.address) {
            address = [revData.address.road, revData.address.city, revData.address.country].filter(Boolean).join(", ")
          }
        }
      } catch { /* ignore */ }
    }
  } else {
    const og = await scrapeOG(inputUrl)
    name = og.title
    imageUrl = og.imageUrl
  }

  const [row] = await db.insert(places).values({
    name: name ?? inputUrl,
    url: inputUrl,
    imageUrl,
    lat: lat != null ? String(lat) : null,
    lng: lng != null ? String(lng) : null,
    address,
    addedBy: actor,
  }).returning()

  await logActivity({ kind: "added", section: "places", actor, itemId: row.id, itemTitle: row.name })
  return NextResponse.json(row, { status: 201 })
}
