"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"

type NominatimResult = { displayName: string; lat: number; lng: number; address: string; osmType: string }

export default function PlacesActions() {
  const [url, setUrl] = useState("")
  const [name, setName] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([])
  const [mode, setMode] = useState<"url" | "manual" | "search">("url")
  const [pending, setPending] = useState(false)
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
      router.push(`/places/${place.id}`)
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
      router.push(`/places/${place.id}`)
    }
    setPending(false)
  }

  function onSearchChange(val: string) {
    setSearchQuery(val)
    setSearchResults([])
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim() || val.length < 2) return
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/us/api/places/nominatim?q=${encodeURIComponent(val)}`)
        if (res.ok) setSearchResults(await res.json())
      } catch { /* ignore */ }
      setSearching(false)
    }, 400)
  }

  async function addFromNominatim(result: NominatimResult) {
    setPending(true)
    const res = await fetch("/us/api/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: result.displayName.split(",")[0].trim(),
        address: result.address,
        lat: result.lat,
        lng: result.lng,
      }),
    })
    if (res.ok) {
      const place = await res.json() as { id: string }
      router.push(`/places/${place.id}`)
    }
    setPending(false)
  }

  const TAB = "px-3 py-1 rounded-full transition-colors text-xs"
  const ACTIVE = `${TAB} bg-neutral-200 dark:bg-neutral-700 font-medium`
  const INACTIVE = `${TAB} text-neutral-500 dark:text-neutral-400`

  return (
    <div className="space-y-2">
      <div className="flex gap-2 text-xs mb-1 flex-wrap">
        <button onClick={() => setMode("url")} className={mode === "url" ? ACTIVE : INACTIVE}>Paste URL</button>
        <button onClick={() => setMode("search")} className={mode === "search" ? ACTIVE : INACTIVE}>Map Search</button>
        <button onClick={() => setMode("manual")} className={mode === "manual" ? ACTIVE : INACTIVE}>Manual</button>
        <a href="/us/places/map" className="ml-auto text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 flex items-center gap-1">
          <span>🗺</span> Map view
        </a>
      </div>

      {mode === "url" && (
        <form onSubmit={submitUrl} className="flex gap-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)} type="url" placeholder="Paste a URL or Google Maps link…"
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500" />
          <button type="submit" disabled={pending || !url.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium disabled:opacity-40 hover:opacity-90 transition-opacity">Add</button>
        </form>
      )}

      {mode === "search" && (
        <div className="space-y-2">
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search for a restaurant, park, hotel…"
            className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500"
          />
          {searching && <p className="text-xs text-neutral-400 px-1">Searching…</p>}
          {searchResults.length > 0 && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden divide-y divide-neutral-100 dark:divide-neutral-800">
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => !pending && addFromNominatim(r)}
                  disabled={pending}
                  className="w-full text-left px-3 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                >
                  <p className="text-sm font-medium leading-tight">{r.displayName.split(",")[0].trim()}</p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 truncate">{r.address}</p>
                </button>
              ))}
            </div>
          )}
          {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
            <p className="text-xs text-neutral-400 px-1">No results. Try a different search.</p>
          )}
        </div>
      )}

      {mode === "manual" && (
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
