import { NextRequest, NextResponse } from "next/server"
import { lc } from "@/lib/sdk"
import { getSuggestions } from "@/lib/suggest"

const DEFAULT_USER = process.env.MEALS_DEFAULT_USER ?? ""

export async function GET(request: NextRequest) {
  const result = await lc.verifyToken(request.headers.get("authorization") ?? "")
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 401 })

  const suggestions = await getSuggestions(DEFAULT_USER, 1)
  if (suggestions.length === 0) {
    return NextResponse.json({ title: "Tonight", primary: "No suggestions", link: "/meals" })
  }

  const top = suggestions[0]
  const parts: string[] = []
  if (top.timeMinutes) parts.push(`${top.timeMinutes} min`)
  if (top.missingIngredients && top.missingIngredients.length > 0) {
    parts.push(`missing ${top.missingIngredients.length} ingredient${top.missingIngredients.length !== 1 ? "s" : ""}`)
  }

  return NextResponse.json({
    title: "Tonight",
    primary: top.name,
    ...(parts.length ? { secondary: parts.join(" · ") } : {}),
    link: `/meals/recipes/${top.recipeId}`,
  })
}
