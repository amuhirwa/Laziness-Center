export const dynamic = "force-dynamic"

import { db } from "@/db"
import { datePlans, places, checklists, checklistItems } from "@/db/schema"
import { asc, eq } from "drizzle-orm"
import Link from "next/link"

function daysFromNow(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - now.getTime()) / 86400_000)
}

export default async function PlansPage() {
  const today = new Date().toISOString().slice(0, 10)
  const allPlans = await db.select().from(datePlans).orderBy(asc(datePlans.date))

  const upcoming = allPlans.filter((p) => p.date >= today)
  const past = allPlans.filter((p) => p.date < today)

  // Fetch linked places and checklist progress in bulk
  const placeIds = [...new Set(allPlans.map((p) => p.placeId).filter(Boolean))] as string[]
  const checklistIds = [...new Set(allPlans.map((p) => p.checklistId).filter(Boolean))] as string[]

  const placesMap = new Map<string, { name: string; imageUrl: string | null }>()
  if (placeIds.length > 0) {
    const rows = await Promise.all(placeIds.map((id) => db.select({ id: places.id, name: places.name, imageUrl: places.imageUrl }).from(places).where(eq(places.id, id))))
    rows.flat().forEach((r) => placesMap.set(r.id, r))
  }

  const checklistProgressMap = new Map<string, { total: number; done: number; name: string }>()
  if (checklistIds.length > 0) {
    const rows = await Promise.all(checklistIds.map(async (id) => {
      const [cl] = await db.select({ name: checklists.name }).from(checklists).where(eq(checklists.id, id))
      const items = await db.select({ completed: checklistItems.completed }).from(checklistItems).where(eq(checklistItems.checklistId, id))
      return { id, name: cl?.name ?? "Checklist", total: items.length, done: items.filter((i) => i.completed).length }
    }))
    rows.forEach((r) => checklistProgressMap.set(r.id, r))
  }

  const PlanCard = ({ plan }: { plan: typeof allPlans[0] }) => {
    const place = plan.placeId ? placesMap.get(plan.placeId) : null
    const cl = plan.checklistId ? checklistProgressMap.get(plan.checklistId) : null
    const days = daysFromNow(plan.date)
    const dateLabel = new Date(plan.date).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })

    return (
      <Link href={`/plans/${plan.id}`}
        className="flex gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
        {place?.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={place.imageUrl} alt={place.name} className="w-14 h-14 object-cover rounded-lg shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm leading-tight">{plan.title}</p>
            <span className="text-xs text-neutral-400 shrink-0">{dateLabel}</span>
          </div>
          {place && <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">📍 {place.name}</p>}
          {cl && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              ✓ {cl.done}/{cl.total} {cl.name}
            </p>
          )}
          {days >= 0 && days <= 7 && (
            <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full bg-pink-50 dark:bg-pink-900/20 text-pink-500 font-medium">
              {days === 0 ? "Today!" : days === 1 ? "Tomorrow" : `In ${days} days`}
            </span>
          )}
        </div>
      </Link>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold">Plans</h1>
        <Link href="/plans/new" className="text-xs px-3 py-1.5 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium hover:opacity-90">
          + New plan
        </Link>
      </div>

      {upcoming.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Upcoming</p>
          {upcoming.map((p) => <PlanCard key={p.id} plan={p} />)}
        </div>
      ) : (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">No upcoming plans. <Link href="/plans/new" className="underline">Create one</Link>.</p>
      )}

      {past.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Past</p>
          {past.reverse().map((p) => <PlanCard key={p.id} plan={p} />)}
        </div>
      )}
    </div>
  )
}
