import { NextRequest, NextResponse } from "next/server"
import { scrapeOG } from "@/lib/og"

export const dynamic = "force-dynamic"

// Debug endpoint — returns raw scraper output without inserting anything
// GET /us/api/debug/scrape?url=https://...
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")
  if (!url) return NextResponse.json({ error: "url param required" }, { status: 400 })

  const result = await scrapeOG(url)
  return NextResponse.json({ url, ...result })
}
