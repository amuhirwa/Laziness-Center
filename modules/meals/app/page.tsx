export const dynamic = "force-dynamic"

import { getSuggestions } from "@/lib/suggest"
import { db } from "@/db"
import { recipes } from "@/db/schema"
import { inArray } from "drizzle-orm"
import Link from "next/link"

const DEFAULT_USER = process.env.MEALS_DEFAULT_USER ?? ""

const MEAL_TYPES = new Set(["breakfast", "lunch", "dinner"])

const FILTER_PILLS = [
  { label: "Any", value: null },
  { label: "Breakfast", value: "breakfast" },
  { label: "Lunch", value: "lunch" },
  { label: "Dinner", value: "dinner" },
  { label: "Dessert", value: "dessert" },
  { label: "Vegetarian", value: "vegetarian" },
  { label: "Vegan", value: "vegan" },
]

type Props = { searchParams: Promise<{ type?: string }> }

export default async function SuggestionsPage({ searchParams }: Props) {
  const { type } = await searchParams
  const activeType = type ?? null

  const isMealType = activeType && MEAL_TYPES.has(activeType)
  const mealType = isMealType ? activeType : undefined
  const tag = activeType && !isMealType ? activeType : undefined

  const suggestions = await getSuggestions(DEFAULT_USER, 3, mealType, tag)

  // Fetch thumbnails for suggested recipes
  const thumbnails = new Map<string, string | null>()
  if (suggestions.length > 0) {
    const rows = await db.select({ id: recipes.id, thumbnailUrl: recipes.thumbnailUrl })
      .from(recipes)
      .where(inArray(recipes.id, suggestions.map((s) => s.recipeId)))
    rows.forEach((r) => thumbnails.set(r.id, r.thumbnailUrl ?? null))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">
          {activeType ? `${activeType.charAt(0).toUpperCase() + activeType.slice(1)} suggestions` : "Tonight"}
        </h1>
        <Link
          href="/recipes/new"
          className="text-sm px-4 py-1.5 bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 rounded-md font-medium hover:opacity-90 transition-opacity"
        >
          + Add recipe
        </Link>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {FILTER_PILLS.map(({ label, value }) => {
          const active = value === activeType
          return (
            <Link
              key={label}
              href={value ? `/?type=${value}` : "/"}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                active
                  ? "bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {suggestions.length === 0 ? (
        <div className="text-sm text-neutral-500 space-y-2">
          {activeType ? (
            <p>No {activeType} recipes yet. <Link href="/recipes/import" className="text-neutral-600 dark:text-neutral-300 underline hover:text-neutral-900 dark:hover:text-white">Import some</Link> or <Link href="/recipes/new" className="text-neutral-600 dark:text-neutral-300 underline hover:text-neutral-900 dark:hover:text-white">add manually</Link>.</p>
          ) : (
            <>
              <p>No recipes yet.</p>
              <p>
                <Link href="/recipes/import" className="text-neutral-600 dark:text-neutral-300 underline hover:text-neutral-900 dark:hover:text-white">
                  Import from MealDB or a URL
                </Link>{" "}
                or{" "}
                <Link href="/recipes/new" className="text-neutral-600 dark:text-neutral-300 underline hover:text-neutral-900 dark:hover:text-white">
                  add one manually
                </Link>.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((s) => (
            <Link
              key={s.recipeId}
              href={`/recipes/${s.recipeId}`}
              className="block rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors overflow-hidden"
            >
              {thumbnails.get(s.recipeId) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbnails.get(s.recipeId)!} alt={s.name}
                  className="w-full h-36 object-cover" />
              )}
              <div className="flex items-start justify-between gap-4 p-4">
                <div>
                  <h2 className="font-medium">{s.name}</h2>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-neutral-500">
                    {s.timeMinutes && <span>{s.timeMinutes} min</span>}
                    {s.difficulty && <span className="capitalize">{s.difficulty}</span>}
                    {s.pantryCheckAvailable && s.missingIngredients && (
                      s.missingIngredients.length === 0
                        ? <span className="text-green-600">All ingredients available</span>
                        : <span className="text-yellow-600">Missing {s.missingIngredients.length} ingredient{s.missingIngredients.length !== 1 ? "s" : ""}</span>
                    )}
                    {!s.pantryCheckAvailable && (
                      <span className="text-neutral-400 dark:text-neutral-600">Pantry unavailable</span>
                    )}
                  </div>
                </div>
                <span className="text-neutral-400 shrink-0">→</span>
              </div>
            </Link>
          ))}

          <p className="text-xs text-neutral-400 dark:text-neutral-600 pt-2">
            Suggestions are weighted by pantry availability, rating, and variety.
          </p>
        </div>
      )}
    </div>
  )
}
