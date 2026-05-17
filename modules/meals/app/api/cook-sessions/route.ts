import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { cookSessions, recipes } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import type { Step } from "@/db/schema"

const DEFAULT_USER = process.env.MEALS_DEFAULT_USER ?? ""

export async function GET(request: NextRequest) {
  // GET /api/cook-sessions?recipeId=... — returns active session for user+recipe
  const recipeId = request.nextUrl.searchParams.get("recipeId")
  if (!recipeId) return NextResponse.json({ error: "recipeId required" }, { status: 400 })

  const [session] = await db
    .select()
    .from(cookSessions)
    .where(
      and(
        eq(cookSessions.userId, DEFAULT_USER),
        eq(cookSessions.recipeId, recipeId),
        eq(cookSessions.status, "active")
      )
    )

  return NextResponse.json({ session: session ?? null })
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { recipeId: string; servings?: number }
  if (!body.recipeId) return NextResponse.json({ error: "recipeId required" }, { status: 400 })

  // Enforce one active session per user
  const [existing] = await db
    .select()
    .from(cookSessions)
    .where(and(eq(cookSessions.userId, DEFAULT_USER), eq(cookSessions.status, "active")))

  if (existing) {
    return NextResponse.json(
      { error: "active session exists", existingSessionId: existing.id },
      { status: 409 }
    )
  }

  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, body.recipeId))
  if (!recipe) return NextResponse.json({ error: "recipe not found" }, { status: 404 })

  const servings = body.servings ?? recipe.servingsDefault

  const [session] = await db.insert(cookSessions).values({
    userId: DEFAULT_USER,
    recipeId: body.recipeId,
    servings,
    status: "active",
  }).returning()

  return NextResponse.json(
    { sessionId: session.id, startedAt: session.startedAt, recipe: { name: recipe.name, steps: recipe.steps as Step[] } },
    { status: 201 }
  )
}
