export const dynamic = "force-dynamic"

import { db } from "@/db"
import { places, wishlistItems, activities, decisionHistory } from "@/db/schema"
import { desc, eq, isNull, ne, or, and } from "drizzle-orm"
import { headers } from "next/headers"
import { getUserId } from "@/lib/identity"
import Link from "next/link"
import DecideWheel from "./decide-wheel"

export type Candidate = {
  id: string
  type: "place" | "wishlist" | "activity"
  title: string
  emoji?: string
}

const CATEGORY_EMOJI: Record<string, string> = {
  game: "🎮", cooking: "🍳", movie: "🎬", show: "📺",
  sport: "⚽", music: "🎵", outdoor: "🌿", other: "✨",
}

export default async function DecidePage() {
  const userId = getUserId(await headers())

  const [placesPool, wishlistPool, activitiesPool, recentDecisions] = await Promise.all([
    db.select({ id: places.id, name: places.name, category: places.category })
      .from(places).where(eq(places.status, "wantToGo"))
      .orderBy(desc(places.isPinned), desc(places.createdAt)),

    db.select({ id: wishlistItems.id, title: wishlistItems.title })
      .from(wishlistItems)
      .where(and(
        eq(wishlistItems.status, "wanted"),
        or(isNull(wishlistItems.hiddenFrom), ne(wishlistItems.hiddenFrom, userId)),
      ))
      .orderBy(desc(wishlistItems.isPinned), desc(wishlistItems.createdAt)),

    db.select({ id: activities.id, title: activities.title, category: activities.category })
      .from(activities).where(eq(activities.status, "wantToDo"))
      .orderBy(desc(activities.isPinned), desc(activities.createdAt)),

    db.select().from(decisionHistory)
      .orderBy(desc(decisionHistory.decidedAt))
      .limit(5),
  ])

  const placeCandidates: Candidate[] = placesPool.map((p) => ({
    id: p.id, type: "place", title: p.name, emoji: "📍",
  }))

  const wishlistCandidates: Candidate[] = wishlistPool.map((w) => ({
    id: w.id, type: "wishlist", title: w.title, emoji: "🛍",
  }))

  const activityCandidates: Candidate[] = activitiesPool.map((a) => ({
    id: a.id, type: "activity", title: a.title,
    emoji: a.category ? CATEGORY_EMOJI[a.category] : "✨",
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold">Decide</h1>
        <Link href="/decide/history" className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300">History</Link>
      </div>

      <DecideWheel
        placeCandidates={placeCandidates}
        wishlistCandidates={wishlistCandidates}
        activityCandidates={activityCandidates}
      />

      {recentDecisions.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <p className="text-xs uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Recent decisions</p>
          {recentDecisions.map((d) => (
            <div key={d.id} className="flex items-center justify-between text-sm">
              <span className="font-medium truncate">{d.winnerTitle}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 capitalize">{d.mode}</span>
                <span className="text-xs text-neutral-400">{new Date(d.decidedAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
