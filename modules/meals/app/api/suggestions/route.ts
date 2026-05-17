import { NextRequest, NextResponse } from "next/server"
import { getSuggestions } from "@/lib/suggest"

const DEFAULT_USER = process.env.MEALS_DEFAULT_USER ?? ""

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const count = Math.min(parseInt(searchParams.get("count") ?? "3"), 10)
  const mealType = searchParams.get("mealType") ?? undefined

  const suggestions = await getSuggestions(DEFAULT_USER, count, mealType)
  return NextResponse.json({ suggestions })
}
