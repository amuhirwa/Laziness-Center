import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { cookSessions, cookedLog, recipes } from "@/db/schema"
import type { Ingredient } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { lc } from "@/lib/sdk"
import { getUserId } from "@/lib/identity"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json() as {
    rating?: number; notes?: string; actualServings?: number
  }

  const userId = getUserId(request.headers)
  const [session] = await db
    .select()
    .from(cookSessions)
    .where(and(eq(cookSessions.id, id), eq(cookSessions.userId, userId)))

  if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 })
  if (session.status !== "active") {
    return NextResponse.json({ error: "session is not active" }, { status: 409 })
  }

  const finishedAt = new Date()
  const actualMinutes = Math.round((finishedAt.getTime() - session.startedAt.getTime()) / 60000)
  const actualServings = body.actualServings ?? session.servings

  // Finalize session
  await db.update(cookSessions).set({ finishedAt, status: "completed" }).where(eq(cookSessions.id, id))

  // Create cooked_log
  const [log] = await db.insert(cookedLog).values({
    recipeId: session.recipeId,
    userId,
    actualMinutes,
    actualServings,
    rating: body.rating,
    notes: body.notes,
  }).returning()

  // Fetch recipe for event payload — scale ingredient quantities to actual servings
  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, session.recipeId))
  if (recipe) {
    const scaleFactor = actualServings / recipe.servingsDefault
    const scaledIngredients = (recipe.ingredients as Ingredient[]).map((ing) => ({
      name: ing.name,
      quantity: ing.quantity != null ? Math.round(ing.quantity * scaleFactor * 100) / 100 : null,
      unit: ing.unit,
    }))

    await lc.publish({
      event: "meals.recipe.cooked",
      data: {
        recipeId: session.recipeId,
        userId,
        servings: actualServings,
        ingredients: scaledIngredients,
        cookedAt: finishedAt.toISOString(),
        sessionId: session.id,
      },
      transport: "stream",
    })
  }

  return NextResponse.json({ cookedLogId: log.id, actualMinutes })
}
