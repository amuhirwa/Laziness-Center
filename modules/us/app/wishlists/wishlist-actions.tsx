"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function WishlistActions() {
  const [url, setUrl] = useState("")
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
      router.push(`/us/wishlists/${item.id}`)
    }
    setPending(false)
  }

  return (
    <div className="space-y-2">
      <form onSubmit={quickAdd} className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a URL to add…"
          type="url"
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500"
        />
        <button type="submit" disabled={pending || !url.trim()}
          className="px-4 py-2 text-sm rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium disabled:opacity-40 hover:opacity-90 transition-opacity">
          Add
        </button>
      </form>
      {notice && <p className="text-xs text-amber-600 dark:text-amber-400">{notice}</p>}
    </div>
  )
}
