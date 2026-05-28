"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { datePlans, places, checklists, checklistItems } from "@/db/schema"

type Plan = typeof datePlans.$inferSelect
type Place = typeof places.$inferSelect | null
type Checklist = typeof checklists.$inferSelect | null
type Item = typeof checklistItems.$inferSelect

export default function PlanDetail({
  plan: initial,
  place,
  checklist,
  items: initialItems,
}: {
  plan: Plan
  place: Place
  checklist: Checklist
  items: Item[]
}) {
  const [plan] = useState(initial)
  const [items, setItems] = useState(initialItems)
  const router = useRouter()

  const dateLabel = new Date(plan.date).toLocaleDateString("en", { weekday: "long", year: "numeric", month: "long", day: "numeric" })

  async function toggleItem(item: Item) {
    const res = await fetch(`/us/api/checklists/${item.checklistId}/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !item.completed }),
    })
    if (res.ok) {
      const updated = await res.json() as Item
      setItems((prev) => prev.map((i) => i.id === item.id ? updated : i))
    }
  }

  async function deletePlan() {
    await fetch(`/us/api/plans/${plan.id}`, { method: "DELETE" })
    router.push("/plans")
  }

  const done = items.filter((i) => i.completed)
  const remaining = items.filter((i) => !i.completed)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-xl">{plan.title}</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{dateLabel}</p>
        </div>
        <button onClick={deletePlan} className="text-xs text-neutral-400 hover:text-red-500 shrink-0">Delete</button>
      </div>

      {plan.notes && (
        <p className="text-sm text-neutral-600 dark:text-neutral-300 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800">{plan.notes}</p>
      )}

      {place && (
        <div className="flex gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          {place.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={place.imageUrl} alt={place.name} className="w-16 h-16 object-cover rounded-lg shrink-0" />
          )}
          <div>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-0.5">Place</p>
            <a href={`/us/places/${place.id}`} className="font-medium text-sm hover:underline">{place.name}</a>
            {place.location && <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{place.location}</p>}
            {place.address && <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">{place.address}</p>}
          </div>
        </div>
      )}

      {checklist && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
            {checklist.name} — {done.length}/{items.length} done
          </p>
          {remaining.map((item) => (
            <div key={item.id} className="flex items-center gap-3 py-1.5">
              <button
                onClick={() => toggleItem(item)}
                className="w-5 h-5 rounded-full border-2 border-neutral-300 dark:border-neutral-600 shrink-0 hover:border-neutral-500 transition-colors"
              />
              <span className="text-sm">{item.text}</span>
            </div>
          ))}
          {done.map((item) => (
            <div key={item.id} className="flex items-center gap-3 py-1.5 opacity-50">
              <button
                onClick={() => toggleItem(item)}
                className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-700 border-2 border-neutral-200 dark:border-neutral-700 shrink-0 flex items-center justify-center text-neutral-500 text-[10px]"
              >✓</button>
              <span className="text-sm line-through">{item.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
