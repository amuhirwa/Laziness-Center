export const dynamic = "force-dynamic"

import { db } from "@/db"
import { places, reactions } from "@/db/schema"
import { desc, eq } from "drizzle-orm"
import Link from "next/link"
import PlacesActions from "./places-actions"
import TurnBanner from "@/app/components/turn-banner"

const STATUSES = ["wantToGo", "visited", "passed"] as const
type Status = typeof STATUSES[number]
const STATUS_LABELS: Record<Status, string> = { wantToGo: "Want to go", visited: "Visited", passed: "Passed" }

type Props = { searchParams: Promise<{ status?: string }> }

export default async function PlacesPage({ searchParams }: Props) {
  const { status: rawStatus } = await searchParams
  const status = (STATUSES.includes(rawStatus as Status) ? rawStatus : "wantToGo") as Status

  const rows = await db.select().from(places)
    .where(eq(places.status, status))
    .orderBy(desc(places.isPinned), desc(places.createdAt))

  const reactCounts = await db.select({ itemId: reactions.itemId }).from(reactions).where(eq(reactions.itemType, "place"))
  const reactMap = new Map<string, number>()
  reactCounts.forEach((r) => reactMap.set(r.itemId, (reactMap.get(r.itemId) ?? 0) + 1))

  return (
    <div className="space-y-5">
      <h1 className="font-semibold">Places</h1>

      <TurnBanner category="places" />
      <PlacesActions />

      <div className="flex gap-1 flex-wrap">
        {STATUSES.map((s) => (
          <Link key={s} href={`/places?status=${s}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              s === status
                ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}>
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">No places {STATUS_LABELS[status].toLowerCase()} yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((place) => (
            <Link key={place.id} href={`/places/${place.id}`}
              className="flex gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
              {place.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={place.imageUrl} alt={place.name} className="w-16 h-16 object-cover rounded-lg shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{place.name}</p>
                {place.location && <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{place.location}</p>}
                {place.category && <p className="text-xs text-neutral-400 dark:text-neutral-500 capitalize mt-0.5">{place.category}</p>}
                <div className="flex gap-3 mt-1">
                  {(reactMap.get(place.id) ?? 0) > 0 && <span className="text-xs text-pink-500">♡ {reactMap.get(place.id)}</span>}
                  {place.isPinned && <span className="text-xs text-yellow-500">★</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
