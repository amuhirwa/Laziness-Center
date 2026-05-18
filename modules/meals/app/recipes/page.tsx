export const dynamic = "force-dynamic"

import { db } from "@/db"
import { recipes } from "@/db/schema"
import { desc } from "drizzle-orm"
import Link from "next/link"

type Props = { searchParams: Promise<{ tag?: string; mealType?: string }> }

export default async function RecipeLibraryPage({ searchParams }: Props) {
  const { tag, mealType } = await searchParams

  const allRecipes = await db.select().from(recipes).orderBy(desc(recipes.updatedAt))

  // Collect all unique tags across the library
  const allTags = [...new Set(allRecipes.flatMap((r) => r.tags))].sort()
  const allMealTypes = [...new Set(allRecipes.flatMap((r) => r.mealTypes))].sort()

  // Apply filters
  const filtered = allRecipes
    .filter((r) => !tag || r.tags.includes(tag))
    .filter((r) => !mealType || r.mealTypes.includes(mealType))

  const activeFilter = tag ?? mealType ?? null

  function filterHref(type: "tag" | "mealType", value: string) {
    return `/recipes?${type}=${encodeURIComponent(value)}`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Recipe Library</h1>
        <div className="flex gap-2">
          <Link href="/recipes/import"
            className="text-sm px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors">
            Import
          </Link>
          <Link href="/recipes/new"
            className="text-sm px-4 py-1.5 bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 rounded-md font-medium hover:opacity-90 transition-opacity">
            + Add
          </Link>
        </div>
      </div>

      {/* Filters */}
      {(allTags.length > 0 || allMealTypes.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          <Link href="/recipes"
            className={`px-3 py-1 rounded-full text-xs transition-colors ${
              !activeFilter
                ? "bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
            }`}>
            All ({allRecipes.length})
          </Link>

          {allMealTypes.map((mt) => (
            <Link key={mt} href={filterHref("mealType", mt)}
              className={`px-3 py-1 rounded-full text-xs capitalize transition-colors ${
                mealType === mt
                  ? "bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              }`}>
              {mt}
            </Link>
          ))}

          {allTags.map((t) => (
            <Link key={t} href={filterHref("tag", t)}
              className={`px-3 py-1 rounded-full text-xs capitalize transition-colors ${
                tag === t
                  ? "bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              }`}>
              {t}
            </Link>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-neutral-500">
          {activeFilter ? `No recipes tagged "${activeFilter}".` : "No recipes yet."}
        </p>
      ) : (
        <div className="space-y-px">
          {filtered.map((r) => (
            <Link key={r.id} href={`/recipes/${r.id}`}
              className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors">
              {r.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.thumbnailUrl} alt={r.name}
                  className="w-10 h-10 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{r.name}</span>
                  {r.isPinned && <span className="text-xs text-yellow-600">★</span>}
                </div>
                <div className="flex gap-2 mt-0.5 flex-wrap text-xs text-neutral-500">
                  {r.timeMinutes && <span>{r.timeMinutes} min</span>}
                  {r.difficulty && <span className="capitalize">{r.difficulty}</span>}
                  {r.tags.slice(0, 4).map((t) => (
                    <span key={t} className="capitalize">{t}</span>
                  ))}
                </div>
              </div>
              <span className="text-neutral-400 shrink-0">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
