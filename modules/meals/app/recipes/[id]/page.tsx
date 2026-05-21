export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { db } from "@/db"
import { recipes, cookSessions } from "@/db/schema"
import type { Ingredient, Step } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import Link from "next/link"
import ShareButton from "./share-button"
import { checkIngredients, priceIngredients } from "@/lib/pantry"
import { findSubRecipe } from "@/lib/subrecipe"
import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { getUserId } from "@/lib/identity"

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ servings?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const [recipe] = await db.select({ name: recipes.name, thumbnailUrl: recipes.thumbnailUrl }).from(recipes).where(eq(recipes.id, id))
  if (!recipe) return { title: "Meals — Laziness Center" }
  const title = `${recipe.name} — Laziness Center`
  return {
    title,
    openGraph: {
      title,
      ...(recipe.thumbnailUrl && { images: [{ url: recipe.thumbnailUrl }] }),
    },
  }
}

export default async function RecipeDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { servings: servingsParam } = await searchParams

  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id))
  if (!recipe) notFound()

  const requestedServings = servingsParam ? parseInt(servingsParam) : recipe.servingsDefault
  const scale = requestedServings / recipe.servingsDefault
  const ings = recipe.ingredients as Ingredient[]
  const steps = recipe.steps as Step[]

  const scaledIngs = ings.map((i) => ({
    ...i,
    quantity: i.quantity != null ? Math.round(i.quantity * scale * 100) / 100 : null,
  }))

  // All other recipes for sub-recipe detection
  const allRecipes = await db.select({ id: recipes.id, name: recipes.name, timeMinutes: recipes.timeMinutes })
    .from(recipes)
  const otherRecipes = allRecipes.filter((r) => r.id !== id)

  const userId = getUserId(await headers())

  // Parallel pantry calls
  const [checkResult, priceResult, activeSession] = await Promise.allSettled([
    checkIngredients(ings.map((i) => i.name), userId),
    priceIngredients(scaledIngs.filter((i) => i.quantity != null && i.unit != null)
      .map((i) => ({ name: i.name, quantity: i.quantity!, unit: i.unit! })), userId),
    db.select().from(cookSessions).where(
      and(eq(cookSessions.recipeId, id), eq(cookSessions.userId, userId), eq(cookSessions.status, "active"))
    ),
  ])

  const check = checkResult.status === "fulfilled" ? checkResult.value : null
  const staplesSet = new Set(check?.staples ?? [])
  const price = priceResult.status === "fulfilled" ? priceResult.value : null
  const session = activeSession.status === "fulfilled" ? activeSession.value[0] : null

  const availableSet = new Set(check?.available ?? [])
  const totalCost = price?.priced.reduce((s, p) => s + p.totalCost, 0) ?? null
  const currency = price?.priced[0]?.currency ?? "RWF"

  return (
    <div className="space-y-6">
      {/* Thumbnail */}
      {recipe.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={recipe.thumbnailUrl} alt={recipe.name}
          className="w-full h-52 object-cover rounded-xl" />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-semibold">{recipe.name}</h1>
            {recipe.isPinned && <span className="text-yellow-600 text-sm">★</span>}
          </div>
          <div className="flex gap-4 text-sm text-neutral-500">
            {recipe.timeMinutes && <span>{recipe.timeMinutes} min</span>}
            {recipe.difficulty && <span className="capitalize">{recipe.difficulty}</span>}
            {recipe.mealTypes.length > 0 && <span>{recipe.mealTypes.join(", ")}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <ShareButton title={recipe.name} />
          <Link href={`/recipes/${id}/edit`}
            className="text-xs text-neutral-600 hover:text-neutral-300 transition-colors">
            Edit
          </Link>
        </div>
      </div>

      {/* Servings scaler */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-neutral-400">Servings:</span>
        {[1, 2, 3, 4, 6].map((n) => (
          <Link key={n} href={`/recipes/${id}?servings=${n}`}
            className={`px-2 py-0.5 rounded ${requestedServings === n
              ? "bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 font-medium"
              : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"}`}>
            {n}
          </Link>
        ))}
      </div>

      {/* Estimated cost */}
      {totalCost !== null && (
        <div className="text-sm">
          <span className="text-neutral-400">Est. cost: </span>
          <span className="text-neutral-800 dark:text-neutral-200 font-medium">
            {new Intl.NumberFormat(undefined, { style: "currency", currency }).format(totalCost)}
          </span>
          {price && price.unpriced.length > 0 && (
            <span className="text-neutral-600 ml-2">
              (no price for {price.unpriced.map((u) => u.name).join(", ")})
            </span>
          )}
        </div>
      )}

      {/* Active session banner */}
      {session && (
        <div className="flex items-center justify-between p-3 rounded-lg border border-yellow-700 bg-yellow-900/20 text-sm">
          <span className="text-yellow-400">You have an active cook session for this recipe.</span>
          <div className="flex gap-2">
            <Link href={`/recipes/${id}/cook?session=${session.id}`}
              className="text-xs px-3 py-1 bg-yellow-600 text-white rounded-md hover:bg-yellow-500">
              Resume
            </Link>
            <form action={`/meals/api/cook-sessions/${session.id}/cancel`} method="POST">
              <button type="submit" className="text-xs px-3 py-1 border border-neutral-300 dark:border-neutral-600 rounded-md text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100">
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Ingredients */}
      {scaledIngs.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-3">Ingredients</h2>
          <ul className="space-y-1.5">
            {scaledIngs.map((ing, i) => {
              const inStock = check ? availableSet.has(ing.name) : null
              const isStaple = check && !inStock ? staplesSet.has(ing.name) : false
              const available = inStock || isStaple
              const subRecipe = findSubRecipe(ing.name, otherRecipes)
              return (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    inStock ? "bg-green-500" :
                    isStaple ? "bg-blue-400" :
                    available === false ? "bg-yellow-500" :
                    "bg-neutral-400 dark:bg-neutral-600"
                  }`} title={isStaple ? "Staple — quick to get" : undefined} />
                  <span className={!available && check ? "text-yellow-600" : ""}>
                    {ing.quantity != null && <span className="font-mono mr-1">{ing.quantity}</span>}
                    {ing.unit && <span className="text-neutral-500 mr-1">{ing.unit}</span>}
                    {ing.name}
                  </span>
                  {subRecipe && (
                    <Link
                      href={`/recipes/${subRecipe.id}`}
                      className="text-xs text-blue-500 hover:text-blue-600 shrink-0 ml-auto"
                      title={`You have a recipe for this: ${subRecipe.name}`}
                    >
                      or make it →
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
          {!check && <p className="text-xs text-neutral-600 mt-2">Pantry unavailable — availability not shown</p>}
        </div>
      )}

      {/* Steps */}
      {steps.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-3">Steps</h2>
          <ol className={`space-y-3 ${recipe.hasStructuredSteps ? "list-decimal list-inside" : ""}`}>
            {steps.map((step, i) => (
              <li key={i} className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                {step.durationMinutes && (
                  <span className="text-xs text-neutral-600 mr-2">[{step.durationMinutes} min]</span>
                )}
                {step.text}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Cook button */}
      {!session && (
        <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <Link
            href={`/recipes/${id}/cook`}
            className="inline-block px-6 py-2.5 bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Start cooking
          </Link>
        </div>
      )}
    </div>
  )
}
