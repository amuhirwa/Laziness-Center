"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Option = { id: string; name: string }

export default function NewPlanForm({ places, checklists }: { places: Option[]; checklists: Option[] }) {
  const [title, setTitle] = useState("")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [placeId, setPlaceId] = useState("")
  const [checklistId, setChecklistId] = useState("")
  const [notes, setNotes] = useState("")
  const [pending, setPending] = useState(false)
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !date) return
    setPending(true)
    const res = await fetch("/us/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        date,
        placeId: placeId || undefined,
        checklistId: checklistId || undefined,
        notes: notes || undefined,
      }),
    })
    if (res.ok) {
      const plan = await res.json() as { id: string }
      router.push(`/plans/${plan.id}`)
    }
    setPending(false)
  }

  const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500"

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">Title *</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Date night, Weekend trip…"
          className={inputCls} />
      </div>

      <div>
        <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">Date *</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
      </div>

      {places.length > 0 && (
        <div>
          <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">Place (optional)</label>
          <select value={placeId} onChange={(e) => setPlaceId(e.target.value)}
            className={inputCls}>
            <option value="">— no place —</option>
            {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {checklists.length > 0 && (
        <div>
          <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">Checklist (optional)</label>
          <select value={checklistId} onChange={(e) => setChecklistId(e.target.value)}
            className={inputCls}>
            <option value="">— no checklist —</option>
            {checklists.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Any notes…"
          className={`${inputCls} resize-none`} />
      </div>

      <button type="submit" disabled={pending || !title.trim() || !date}
        className="w-full py-2 text-sm rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium disabled:opacity-40 hover:opacity-90 transition-opacity">
        {pending ? "Creating…" : "Create plan"}
      </button>
    </form>
  )
}
