export const dynamic = "force-dynamic"

import { getSuggestions } from "@/lib/suggest"
import Link from "next/link"

const DEFAULT_USER = process.env.MEALS_DEFAULT_USER ?? ""

export default async function SuggestionsPage() {
  const suggestions = await getSuggestions(DEFAULT_USER, 3)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold">Tonight</h1>
        <Link
          href="/meals/recipes/new"
          className="text-sm px-4 py-1.5 bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 rounded-md font-medium hover:opacity-90 transition-opacity"
        >
          + Add recipe
        </Link>
      </div>

      {suggestions.length === 0 ? (
        <div className="text-sm text-neutral-500 space-y-2">
          <p>No recipes yet.</p>
          <p>
            <Link href="/meals/recipes/import" className="text-neutral-600 dark:text-neutral-300 underline hover:text-neutral-900 dark:hover:text-white">
              Import from a URL
            </Link>{" "}
            or{" "}
            <Link href="/meals/recipes/new" className="text-neutral-600 dark:text-neutral-300 underline hover:text-neutral-900 dark:hover:text-white">
              add one manually
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((s) => (
            <Link
              key={s.recipeId}
              href={`/meals/recipes/${s.recipeId}`}
              className="block p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
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
            Suggestions refresh hourly and exclude recipes cooked recently.
          </p>
        </div>
      )}
    </div>
  )
}
