import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search")
    url.searchParams.set("q", q)
    url.searchParams.set("format", "json")
    url.searchParams.set("addressdetails", "1")
    url.searchParams.set("limit", "6")

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(4000),
      headers: { "User-Agent": "LazinessCenter/1.0 (self-hosted personal app)" },
      next: { revalidate: 60 },
    })
    if (!res.ok) return NextResponse.json([])

    type NominatimResult = {
      display_name: string
      lat: string
      lon: string
      type: string
      address?: { road?: string; city?: string; country?: string; suburb?: string; town?: string }
    }

    const data: NominatimResult[] = await res.json()

    const results = data.map((r) => ({
      displayName: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      osmType: r.type,
      address: [
        r.address?.road,
        r.address?.suburb,
        r.address?.city ?? r.address?.town,
        r.address?.country,
      ].filter(Boolean).join(", "),
    }))

    return NextResponse.json(results, {
      headers: { "Cache-Control": "public, s-maxage=60" },
    })
  } catch {
    return NextResponse.json([])
  }
}
