import { NextRequest, NextResponse } from "next/server"
import { getSuggestions } from "@/lib/suggest"
import { getUserId } from "@/lib/identity"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const count = Math.min(parseInt(searchParams.get("count") ?? "3"), 10)
  const mealType = searchParams.get("mealType") ?? undefined

  const suggestions = await getSuggestions(getUserId(request.headers), count, mealType)
  return NextResponse.json({ suggestions })
}
