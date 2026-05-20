"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function PlacesActions() {
  const [url, setUrl] = useState("")
  const [name, setName] = useState("")
  const [mode, setMode] = useState<"url" | "manual">("url")
  const [pending, setPending] = useState(false)
  const router = useRouter()

  async function submitUrl(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setPending(true)
    const res = await fetch("/us/api/places/quick-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    })
    if (res.ok) {
      const place = await res.json() as { id: string }
      router.push(`/us/places/${place.id}`)
    }
    setPending(false)
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setPending(true)
    const res = await fetch("/us/api/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      const place = await res.json() as { id: string }
      router.push(`/us/places/${place.id}`)
    }
    setPending(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 text-xs mb-1">
        <button onClick={() => setMode("url")} className={`px-3 py-1 rounded-full transition-colors ${mode === "url" ? "bg-neutral-200 dark:bg-neutral-700 font-medium" : "text-neutral-500"}`}>Paste URL</button>
        <button onClick={() => setMode("manual")} className={`px-3 py-1 rounded-full transition-colors ${mode === "manual" ? "bg-neutral-200 dark:bg-neutral-700 font-medium" : "text-neutral-500"}`}>Manual</button>
      </div>
      {mode === "url" ? (
        <form onSubmit={submitUrl} className="flex gap-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)} type="url" placeholder="Paste a URL or Maps link…"
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500" />
          <button type="submit" disabled={pending || !url.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium disabled:opacity-40 hover:opacity-90 transition-opacity">Add</button>
        </form>
      ) : (
        <form onSubmit={submitManual} className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Place name…"
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500" />
          <button type="submit" disabled={pending || !name.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium disabled:opacity-40 hover:opacity-90 transition-opacity">Add</button>
        </form>
      )}
    </div>
  )
}
