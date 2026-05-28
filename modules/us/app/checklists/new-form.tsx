"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Template = { id: string; name: string }

export default function NewChecklistForm({ templates }: { templates: Template[] }) {
  const [name, setName] = useState("")
  const [pending, setPending] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setPending(true)
    await fetch("/us/api/checklists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    setName("")
    setPending(false)
    router.refresh()
  }

  async function useTemplate(id: string) {
    setPending(true)
    const res = await fetch(`/us/api/checklists/${id}/duplicate`, { method: "POST" })
    if (res.ok) {
      const newCl = await res.json() as { id: string }
      router.push(`/checklists/${newCl.id}`)
    }
    setPending(false)
  }

  return (
    <div className="space-y-2">
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New checklist name…"
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500"
        />
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="px-4 py-2 text-sm rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          Add
        </button>
      </form>

      {templates.length > 0 && (
        <button onClick={() => setShowTemplates(!showTemplates)}
          className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">
          {showTemplates ? "▾" : "▸"} Start from template
        </button>
      )}

      {showTemplates && templates.length > 0 && (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden divide-y divide-neutral-100 dark:divide-neutral-800">
          {templates.map((t) => (
            <button key={t.id} onClick={() => !pending && useTemplate(t.id)} disabled={pending}
              className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center justify-between disabled:opacity-40 transition-colors">
              {t.name}
              <span className="text-xs text-neutral-400">Use →</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
