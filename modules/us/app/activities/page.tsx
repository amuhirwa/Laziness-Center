export const dynamic = "force-dynamic"

import { db } from "@/db"
import { activities, reactions } from "@/db/schema"
import { desc, eq } from "drizzle-orm"
import Link from "next/link"
import ActivityActions from "./activity-actions"
import TurnBanner from "@/app/components/turn-banner"

const STATUSES = ["wantToDo", "done", "skipped"] as const
type Status = typeof STATUSES[number]
const STATUS_LABELS: Record<Status, string> = { wantToDo: "Want to do", done: "Done", skipped: "Skipped" }

const CATEGORY_EMOJI: Record<string, string> = {
  game: "🎮", cooking: "🍳", movie: "🎬", show: "📺",
  sport: "⚽", music: "🎵", outdoor: "🌿", other: "✨",
}

type Props = { searchParams: Promise<{ status?: string }> }

export default async function ActivitiesPage({ searchParams }: Props) {
  const { status: rawStatus } = await searchParams
  const status = (STATUSES.includes(rawStatus as Status) ? rawStatus : "wantToDo") as Status

  const rows = await db.select().from(activities)
    .where(eq(activities.status, status))
    .orderBy(desc(activities.isPinned), desc(activities.createdAt))

  const reactCounts = await db.select({ itemId: reactions.itemId }).from(reactions)
    .where(eq(reactions.itemType, "activity"))
  const reactMap = new Map<string, number>()
  reactCounts.forEach((r) => reactMap.set(r.itemId, (reactMap.get(r.itemId) ?? 0) + 1))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold">Activities</h1>
      </div>

      <TurnBanner category="activities" />
      <ActivityActions />

      <div className="flex gap-1 flex-wrap">
        {STATUSES.map((s) => (
          <Link key={s} href={`/activities?status=${s}`}
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
        <p className="text-sm text-neutral-400 dark:text-neutral-500">Nothing {STATUS_LABELS[status].toLowerCase()} yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((item) => (
            <Link key={item.id} href={`/activities/${item.id}`}
              className="flex items-start gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
              {item.category && (
                <span className="text-xl shrink-0 mt-0.5">{CATEGORY_EMOJI[item.category] ?? "✨"}</span>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm leading-tight">{item.title}</p>
                {item.description && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1">{item.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  {item.category && (
                    <span className="text-xs text-neutral-400 capitalize">{item.category}</span>
                  )}
                  {item.linkedType && (
                    <span className="text-xs text-blue-400">🔗 {item.linkedType}</span>
                  )}
                  {(reactMap.get(item.id) ?? 0) > 0 && (
                    <span className="text-xs text-pink-500">♡ {reactMap.get(item.id)}</span>
                  )}
                  {item.isPinned && <span className="text-xs text-yellow-500">★</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
