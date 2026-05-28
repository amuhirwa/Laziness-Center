export const dynamic = "force-dynamic"

import { db } from "@/db"
import { activity } from "@/db/schema"
import { desc, gte } from "drizzle-orm"
import Link from "next/link"

const SECTION_HREF: Record<string, string> = {
  checklist: "/checklists",
  wishlist: "/wishlists",
  places: "/places",
  activities: "/activities",
  plans: "/plans",
  decide: "/decide",
}

const KIND_LABEL: Record<string, string> = {
  added: "added",
  completed: "completed",
  reacted: "reacted to",
  "status-changed": "updated",
  commented: "commented on",
  visited: "visited",
  archived: "archived",
  decide: "decided on",
}

function itemHref(row: { section: string; itemId: string | null }): string | null {
  if (!row.itemId) return null
  if (row.section === "checklist") return `/checklists/${row.itemId}`
  if (row.section === "wishlist") return `/wishlists/${row.itemId}`
  if (row.section === "places") return `/places/${row.itemId}`
  if (row.section === "activities") return `/activities/${row.itemId}`
  if (row.section === "plans") return `/plans/${row.itemId}`
  return null
}

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return Math.floor(hrs / 24) + "d ago"
}

export default async function ActivityPage() {
  const cutoff = new Date(Date.now() - 30 * 86400_000)
  const rawRows = await db.select().from(activity)
    .where(gte(activity.createdAt, cutoff))
    .orderBy(desc(activity.createdAt))
    .limit(100)

  // Coalesce same actor+kind+section+itemId within 10 min
  const WINDOW_MS = 10 * 60 * 1000
  const coalesced: (typeof rawRows[0] & { count: number })[] = []
  for (const row of rawRows) {
    const last = coalesced[coalesced.length - 1]
    if (
      last && last.actor === row.actor && last.kind === row.kind &&
      last.section === row.section && last.itemId === row.itemId &&
      Math.abs(last.createdAt!.getTime() - row.createdAt!.getTime()) < WINDOW_MS
    ) {
      last.count++
    } else {
      coalesced.push({ ...row, count: 1 })
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-semibold">Activity</h1>

      {coalesced.length === 0 ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">Nothing in the last 30 days.</p>
      ) : (
        <ul className="space-y-1">
          {coalesced.map((row) => {
            const name = row.actor.split("@")[0]
            const verb = KIND_LABEL[row.kind] ?? row.kind
            const href = itemHref(row)
            return (
              <li key={row.id} className="flex items-baseline gap-2 py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                <span className="text-xs text-neutral-400 dark:text-neutral-500 shrink-0 w-10 text-right">
                  {relativeTime(row.createdAt!)}
                </span>
                <p className="text-sm flex-1">
                  <span className="font-medium">{name}</span>{" "}
                  <span className="text-neutral-500 dark:text-neutral-400">{verb}</span>{" "}
                  {href ? (
                    <Link href={href} className="hover:underline">{row.itemTitle ?? row.section}</Link>
                  ) : (
                    <span>{row.itemTitle ?? row.section}</span>
                  )}
                  {row.count > 1 && <span className="text-neutral-400 dark:text-neutral-500"> ×{row.count}</span>}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
