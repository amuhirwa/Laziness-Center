import { NextRequest, NextResponse } from "next/server"
import { importFromUrl } from "@/lib/import"
import { getUserId, isGuest } from "@/lib/identity"

export async function POST(request: NextRequest) {
  if (isGuest(getUserId(request.headers))) return NextResponse.json({ error: "unauthorized" }, { status: 403 })
  const body = await request.json() as { url?: string }
  if (!body.url) return NextResponse.json({ error: "url required" }, { status: 400 })

  const result = await importFromUrl(body.url)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error, pageTitle: result.pageTitle },
      { status: 422 }
    )
  }
  return NextResponse.json({ recipe: result.recipe })
}
