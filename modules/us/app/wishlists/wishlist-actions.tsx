"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function WishlistActions() {
  const [mode, setMode] = useState<"url" | "manual">("url")
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [price, setPrice] = useState("")
  const [currency, setCurrency] = useState("RWF")
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const router = useRouter()

  async function quickAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setPending(true)
    setNotice(null)
    const res = await fetch("/us/api/wishlist/quick-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    })
    if (res.ok) {
      const item = await res.json() as { id: string; hadMeta: boolean }
      if (!item.hadMeta) setNotice("Couldn't fetch metadata — edit the item to fill in details.")
      setUrl("")
      router.push(`/wishlists/${item.id}`)
    }
    setPending(false)
  }

  async function manualAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setPending(true)
    const res = await fetch("/us/api/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        price: price || undefined,
        currency: price ? (currency || "RWF") : undefined,
      }),
    })
    if (res.ok) {
      const item = await res.json() as { id: string }
      setTitle("")
      setPrice("")
      router.push(`/wishlists/${item.id}`)
    }
    setPending(false)
  }

  const TAB = "px-3 py-1 rounded-full text-xs transition-colors"
  const ACTIVE = `${TAB} bg-neutral-200 dark:bg-neutral-700 font-medium`
  const INACTIVE = `${TAB} text-neutral-500 dark:text-neutral-400`

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button onClick={() => setMode("url")} className={mode === "url" ? ACTIVE : INACTIVE}>Paste URL</button>
        <button onClick={() => setMode("manual")} className={mode === "manual" ? ACTIVE : INACTIVE}>Manual</button>
      </div>

      {mode === "url" ? (
        <form onSubmit={quickAdd} className="flex gap-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a URL to add…" type="url"
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500" />
          <button type="submit" disabled={pending || !url.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium disabled:opacity-40 hover:opacity-90 transition-opacity">
            Add
          </button>
        </form>
      ) : (
        <form onSubmit={manualAdd} className="space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you want?"
            className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500" />
          <div className="flex gap-2">
            <input value={currency} onChange={(e) => setCurrency(e.target.value)}
              placeholder="RWF"
              className="w-20 px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500" />
            <input value={price} onChange={(e) => setPrice(e.target.value)}
              placeholder="Price (optional)" type="number" min="0" step="any"
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500" />
            <button type="submit" disabled={pending || !title.trim()}
              className="px-4 py-2 text-sm rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium disabled:opacity-40 hover:opacity-90 transition-opacity">
              Add
            </button>
          </div>
        </form>
      )}

      {notice && <p className="text-xs text-amber-600 dark:text-amber-400">{notice}</p>}
    </div>
  )
}
