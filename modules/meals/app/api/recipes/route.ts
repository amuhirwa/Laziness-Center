import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { recipes } from "@/db/schema"
import type { Step, Ingredient } from "@/db/schema"
import { and, arrayContains, eq, ilike, or } from "drizzle-orm"
import { getUserId } from "@/lib/identity"

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const mealType = sp.get("mealType")
  const difficulty = sp.get("difficulty") as "easy" | "medium" | "hard" | null
  const pinned = sp.get("pinned")
  const q = sp.get("q")

  let rows = await db.select().from(recipes)

  if (mealType) rows = rows.filter((r) => r.mealTypes.includes(mealType))
  if (difficulty) rows = rows.filter((r) => r.difficulty === difficulty)
  if (pinned === "true") rows = rows.filter((r) => r.isPinned)
  if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()))

  return NextResponse.json({ recipes: rows })
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    name: string
    timeMinutes?: number
    servingsDefault?: number
    difficulty?: "easy" | "medium" | "hard"
    mealTypes?: string[]
    tags?: string[]
    steps?: Step[]
    ingredients?: Ingredient[]
    sourceUrl?: string
    thumbnailUrl?: string
  }

  if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 })

  const steps: Step[] = body.steps ?? []
  const hasStructuredSteps = steps.length > 1 || steps.some((s) => s.durationMinutes != null)

  const [recipe] = await db.insert(recipes).values({
    name: body.name.trim(),
    timeMinutes: body.timeMinutes,
    servingsDefault: body.servingsDefault ?? 2,
    difficulty: body.difficulty,
    mealTypes: body.mealTypes ?? [],
    tags: body.tags ?? [],
    steps,
    hasStructuredSteps,
    ingredients: body.ingredients ?? [],
    sourceUrl: body.sourceUrl,
    thumbnailUrl: body.thumbnailUrl,
    createdBy: getUserId(request.headers),
  }).returning({ id: recipes.id })

  return NextResponse.json({ recipeId: recipe.id }, { status: 201 })
}
