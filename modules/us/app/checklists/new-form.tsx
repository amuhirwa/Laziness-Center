"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function NewChecklistForm() {
  const [name, setName] = useState("")
  const [pending, setPending] = useState(false)
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

  return (
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
  )
}
