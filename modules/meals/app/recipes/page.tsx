import { db } from "@/db"
import { recipes } from "@/db/schema"
import { desc } from "drizzle-orm"
import Link from "next/link"

export default async function RecipeLibraryPage() {
  const allRecipes = await db.select().from(recipes).orderBy(desc(recipes.updatedAt))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold">Recipe Library</h1>
        <div className="flex gap-2">
          <Link href="/meals/recipes/import"
            className="text-sm px-3 py-1.5 border border-neutral-700 rounded-md text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 transition-colors">
            Import URL
          </Link>
          <Link href="/meals/recipes/new"
            className="text-sm px-4 py-1.5 bg-neutral-100 text-neutral-900 rounded-md font-medium hover:bg-white transition-colors">
            + Add
          </Link>
        </div>
      </div>

      {allRecipes.length === 0 ? (
        <p className="text-sm text-neutral-500">No recipes yet.</p>
      ) : (
        <div className="space-y-px">
          {allRecipes.map((r) => (
            <Link key={r.id} href={`/meals/recipes/${r.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 border-b border-neutral-800 hover:bg-neutral-900 transition-colors">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{r.name}</span>
                  {r.isPinned && <span className="text-xs text-yellow-600">★ pinned</span>}
                </div>
                <div className="flex gap-3 mt-0.5 text-xs text-neutral-600">
                  {r.timeMinutes && <span>{r.timeMinutes} min</span>}
                  {r.difficulty && <span className="capitalize">{r.difficulty}</span>}
                  {r.tags.slice(0, 3).map((t) => <span key={t}>{t}</span>)}
                </div>
              </div>
              <span className="text-neutral-700 shrink-0">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
