import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { recipes } from "@/db/schema"
import type { Ingredient, Step } from "@/db/schema"
import { eq } from "drizzle-orm"
import { priceIngredients } from "@/lib/pantry"
import { getUserId, isGuest } from "@/lib/identity"

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params
  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id))
  if (!recipe) return NextResponse.json({ error: "not found" }, { status: 404 })

  const requestedServings = request.nextUrl.searchParams.get("servings")
  const scaleFactor = requestedServings
    ? parseInt(requestedServings) / recipe.servingsDefault
    : 1

  const ings = recipe.ingredients as Ingredient[]
  const scaledIngs = ings.map((i) => ({
    ...i,
    quantity: i.quantity != null ? Math.round(i.quantity * scaleFactor * 100) / 100 : null,
  }))

  // Estimated cost from pantry
  let estimatedCost: { total: number; currency: string; missingPriceFor: string[] } | null = null
  const priceable = scaledIngs.filter((i) => i.quantity != null && i.unit != null)
  if (priceable.length > 0) {
    const priceResult = await priceIngredients(
      priceable.map((i) => ({ name: i.name, quantity: i.quantity!, unit: i.unit! })),
      getUserId(request.headers)
    )
    if (priceResult) {
      const total = priceResult.priced.reduce((s, p) => s + p.totalCost, 0)
      const currency = priceResult.priced[0]?.currency ?? "RWF"
      estimatedCost = {
        total: Math.round(total * 100) / 100,
        currency,
        missingPriceFor: priceResult.unpriced.map((u) => u.name),
      }
    }
  }

  return NextResponse.json({
    ...recipe,
    servingsRequested: requestedServings ? parseInt(requestedServings) : null,
    ingredients: scaledIngs,
    estimatedCost,
  })
}

export async function PUT(request: NextRequest, { params }: Params) {
  if (isGuest(getUserId(request.headers))) return NextResponse.json({ error: "unauthorized" }, { status: 403 })
  const { id } = await params
  const body = await request.json() as Partial<{
    name: string; timeMinutes: number; servingsDefault: number
    difficulty: "easy" | "medium" | "hard"; mealTypes: string[]; tags: string[]
    steps: Step[]; ingredients: Ingredient[]; sourceUrl: string; thumbnailUrl: string
  }>

  const steps = body.steps
  const hasStructuredSteps = steps
    ? steps.length > 1 || steps.some((s) => s.durationMinutes != null)
    : undefined

  const [updated] = await db.update(recipes)
    .set({ ...body, hasStructuredSteps, updatedAt: new Date() })
    .where(eq(recipes.id, id))
    .returning({ id: recipes.id })

  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json({ recipeId: updated.id })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  if (isGuest(getUserId(request.headers))) return NextResponse.json({ error: "unauthorized" }, { status: 403 })
  const { id } = await params
  await db.delete(recipes).where(eq(recipes.id, id))
  return new NextResponse(null, { status: 204 })
}
