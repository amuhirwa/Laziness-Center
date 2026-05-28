export const dynamic = "force-dynamic"

import { db } from "@/db"
import { places, placeVisits, wishlistItems, checklists, checklistItems, activity, decisionHistory, activities } from "@/db/schema"
import { and, count, eq, gte, isNotNull, sql } from "drizzle-orm"

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
      <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">{sub}</p>}
    </div>
  )
}

export default async function StatsPage() {
  const now = new Date()
  const yearStart = new Date(now.getFullYear(), 0, 1)

  // Places
  const placesVisitedThisYear = await db.select({ c: count() }).from(placeVisits)
    .where(gte(placeVisits.visitedAt, yearStart))
  const placesVisitedTotal = await db.select({ c: count() }).from(placeVisits)
  const placesStatuses = await db.select({ status: places.status, c: count() }).from(places).groupBy(places.status)
  const placeStatusMap = Object.fromEntries(placesStatuses.map((r) => [r.status, r.c]))

  // Wishlists
  const wishlistStatuses = await db.select({ status: wishlistItems.status, c: count() }).from(wishlistItems).groupBy(wishlistItems.status)
  const wlMap = Object.fromEntries(wishlistStatuses.map((r) => [r.status, r.c]))
  const clearedThisYear = await db.select({ c: count() }).from(wishlistItems)
    .where(and(sql`status IN ('bought','received')`, gte(wishlistItems.statusChangedAt, yearStart)))

  // Budget totals
  const budgetByStatus = await db.select({
    status: wishlistItems.status,
    currency: wishlistItems.currency,
    total: sql<string>`COALESCE(SUM(price::numeric),0)`,
  }).from(wishlistItems).where(isNotNull(wishlistItems.price)).groupBy(wishlistItems.status, wishlistItems.currency)

  const wantedTotal = budgetByStatus.filter((r) => r.status === "wanted").map((r) => `${r.currency ?? "RWF"} ${parseFloat(r.total).toLocaleString()}`).join(" + ")
  const spentTotal = budgetByStatus.filter((r) => r.status !== "wanted").map((r) => `${r.currency ?? "RWF"} ${parseFloat(r.total).toLocaleString()}`).join(" + ")

  // Decisions
  const decisionsThisYear = await db.select({ c: count() }).from(decisionHistory)
    .where(gte(decisionHistory.decidedAt, yearStart))
  const decisionsTotal = await db.select({ c: count() }).from(decisionHistory)

  // Activities done
  const activitiesDoneThisYear = await db.select({ c: count() }).from(activities)
    .where(and(eq(activities.status, "done"), gte(activities.updatedAt, yearStart)))

  // Checklists
  const itemsCheckedOff = await db.select({ c: count() }).from(checklistItems).where(eq(checklistItems.completed, true))
  const itemsCheckedThisYear = await db.select({ c: count() }).from(checklistItems)
    .where(and(eq(checklistItems.completed, true), gte(checklistItems.completedAt, yearStart)))
  const allLists = await db.select({ id: checklists.id }).from(checklists).where(eq(checklists.isArchived, false))
  const fullyDoneLists = (await Promise.all(allLists.map(async (cl) => {
    const [totalRow] = await db.select({ total: count() }).from(checklistItems).where(eq(checklistItems.checklistId, cl.id))
    const [doneRow] = await db.select({ done: count() }).from(checklistItems).where(and(eq(checklistItems.checklistId, cl.id), eq(checklistItems.completed, true)))
    return totalRow.total > 0 && totalRow.total === doneRow.done
  }))).filter(Boolean).length

  // Monthly activity (last 12 months)
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const monthlyActivity = await db.select({
    month: sql<string>`to_char(created_at, 'YYYY-MM')`,
    c: count(),
  }).from(activity).where(gte(activity.createdAt, twelveMonthsAgo)).groupBy(sql`to_char(created_at, 'YYYY-MM')`)

  const monthMap = new Map(monthlyActivity.map((r) => [r.month, r.c]))
  const months: { label: string; key: string; val: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleDateString("en", { month: "short" })
    months.push({ label, key, val: monthMap.get(key) ?? 0 })
  }
  const maxMonth = Math.max(...months.map((m) => m.val), 1)

  return (
    <div className="space-y-8">
      <h1 className="font-semibold">Stats</h1>

      {/* This year */}
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-400 dark:text-neutral-500 mb-3">{now.getFullYear()}</p>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Places visited" value={placesVisitedThisYear[0]?.c ?? 0} />
          <StatCard label="Wishlists cleared" value={clearedThisYear[0]?.c ?? 0} sub="bought or received" />
          <StatCard label="Items checked off" value={itemsCheckedThisYear[0]?.c ?? 0} />
          <StatCard label="Fully done lists" value={fullyDoneLists} sub="all items complete" />
          <StatCard label="Activities done" value={activitiesDoneThisYear[0]?.c ?? 0} />
          <StatCard label="Decisions made" value={decisionsThisYear[0]?.c ?? 0} sub="spun the wheel" />
        </div>
      </div>

      {/* All time */}
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-400 dark:text-neutral-500 mb-3">All time</p>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total place visits" value={placesVisitedTotal[0]?.c ?? 0} />
          <StatCard label="Items ever checked" value={itemsCheckedOff[0]?.c ?? 0} />
          <StatCard label="Total decisions" value={decisionsTotal[0]?.c ?? 0} sub="wheel spins" />
          {wantedTotal && <StatCard label="Wanted" value={wantedTotal} />}
          {spentTotal && <StatCard label="Spent" value={spentTotal} />}
        </div>
      </div>

      {/* Place status distribution */}
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-400 dark:text-neutral-500 mb-3">Places</p>
        <div className="flex gap-4 text-sm">
          <span className="text-blue-500">{placeStatusMap.wantToGo ?? 0} want to go</span>
          <span className="text-green-500">{placeStatusMap.visited ?? 0} visited</span>
          <span className="text-neutral-400">{placeStatusMap.passed ?? 0} passed</span>
        </div>
      </div>

      {/* Wishlist distribution */}
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-400 dark:text-neutral-500 mb-3">Wishlist</p>
        <div className="flex gap-4 text-sm flex-wrap">
          <span className="text-neutral-700 dark:text-neutral-300">{wlMap.wanted ?? 0} wanted</span>
          <span className="text-green-500">{wlMap.bought ?? 0} bought</span>
          <span className="text-blue-500">{wlMap.received ?? 0} received</span>
          <span className="text-neutral-400">{wlMap.passed ?? 0} passed</span>
        </div>
      </div>

      {/* Activity bar chart */}
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-400 dark:text-neutral-500 mb-3">Activity (last 12 months)</p>
        <div className="flex items-end gap-1 h-24">
          {months.map((m) => (
            <div key={m.key} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-neutral-900 dark:bg-neutral-100 rounded-t-sm min-h-[2px] transition-all"
                style={{ height: m.val === 0 ? "2px" : `${Math.max(4, Math.round((m.val / maxMonth) * 88))}px` }}
                title={`${m.val} activities`}
              />
              <span className="text-[9px] text-neutral-400 rotate-0">{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
