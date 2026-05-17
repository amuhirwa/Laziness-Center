import { NextRequest, NextResponse } from "next/server"
import { importFromUrl } from "@/lib/import"

export async function POST(request: NextRequest) {
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
