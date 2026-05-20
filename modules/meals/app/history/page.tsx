export const dynamic = "force-dynamic"

import { db } from "@/db"
import { cookedLog, recipes } from "@/db/schema"
import { and, desc, eq } from "drizzle-orm"
import Link from "next/link"
import { headers } from "next/headers"
import { getUserId } from "@/lib/identity"

export default async function CookHistoryPage() {
  const userId = getUserId(await headers())

  const entries = await db
    .select({
      id: cookedLog.id,
      recipeId: cookedLog.recipeId,
      cookedAt: cookedLog.cookedAt,
      actualMinutes: cookedLog.actualMinutes,
      actualServings: cookedLog.actualServings,
      rating: cookedLog.rating,
      notes: cookedLog.notes,
      recipeName: recipes.name,
      thumbnailUrl: recipes.thumbnailUrl,
    })
    .from(cookedLog)
    .leftJoin(recipes, eq(cookedLog.recipeId, recipes.id))
    .where(eq(cookedLog.userId, userId))
    .orderBy(desc(cookedLog.cookedAt))
    .limit(100)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Cook History</h1>
        <span className="text-sm text-neutral-500">{entries.length} sessions</span>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-neutral-500">No cooked sessions yet. Start cooking a recipe to see history here.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="flex gap-4 items-start p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
              {entry.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={entry.thumbnailUrl} alt={entry.recipeName ?? ""}
                  className="w-16 h-16 object-cover rounded-lg shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/recipes/${entry.recipeId}`}
                    className="font-medium text-sm hover:underline truncate">
                    {entry.recipeName ?? "Deleted recipe"}
                  </Link>
                  <span className="text-xs text-neutral-500 shrink-0">
                    {new Date(entry.cookedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                <div className="flex gap-3 mt-1 text-xs text-neutral-500">
                  {entry.rating != null && (
                    <span>{"★".repeat(entry.rating)}{"☆".repeat(5 - entry.rating)}</span>
                  )}
                  {entry.actualServings != null && <span>{entry.actualServings} servings</span>}
                  {entry.actualMinutes != null && <span>{entry.actualMinutes} min</span>}
                </div>
                {entry.notes && (
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 line-clamp-2">{entry.notes}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
