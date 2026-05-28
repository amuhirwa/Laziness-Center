"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function UseTemplateButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false)
  const router = useRouter()

  async function use() {
    setPending(true)
    const res = await fetch(`/us/api/checklists/${id}/duplicate`, { method: "POST" })
    if (res.ok) {
      const newCl = await res.json() as { id: string }
      router.push(`/checklists/${newCl.id}`)
    }
    setPending(false)
  }

  return (
    <button onClick={use} disabled={pending}
      className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 transition-colors">
      {pending ? "Creating…" : "Use"}
    </button>
  )
}
