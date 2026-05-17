import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { cookedLog, recipes } from "@/db/schema"
import { and, desc, eq } from "drizzle-orm"

const DEFAULT_USER = process.env.MEALS_DEFAULT_USER ?? ""

export async function GET(request: NextRequest) {
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") ?? "20"), 100)
  const recipeId = request.nextUrl.searchParams.get("recipeId")

  const rows = await db
    .select({
      id: cookedLog.id,
      recipeId: cookedLog.recipeId,
      cookedAt: cookedLog.cookedAt,
      actualMinutes: cookedLog.actualMinutes,
      actualServings: cookedLog.actualServings,
      rating: cookedLog.rating,
      notes: cookedLog.notes,
      recipeName: recipes.name,
    })
    .from(cookedLog)
    .leftJoin(recipes, eq(cookedLog.recipeId, recipes.id))
    .where(
      and(
        eq(cookedLog.userId, DEFAULT_USER),
        recipeId ? eq(cookedLog.recipeId, recipeId) : undefined
      )
    )
    .orderBy(desc(cookedLog.cookedAt))
    .limit(limit)

  return NextResponse.json({ entries: rows })
}
