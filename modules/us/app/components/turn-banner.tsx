"use client"

import { useEffect, useState } from "react"

type TurnData = { currentUserId: string; currentUserName: string } | null

export default function TurnBanner({ category }: { category: "checklists" | "wishlists" | "places" }) {
  const [turn, setTurn] = useState<TurnData>(null)
  const [passing, setPassing] = useState(false)

  useEffect(() => {
    fetch(`/us/api/turns/${category}`)
      .then((r) => r.json())
      .then((d) => d.currentUserId ? setTurn(d) : null)
      .catch(() => null)
  }, [category])

  async function passTurn() {
    setPassing(true)
    const res = await fetch(`/us/api/turns/${category}`, { method: "POST" })
    if (res.ok) setTurn(await res.json())
    setPassing(false)
  }

  if (!turn) return null

  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-sm">
      <span className="text-neutral-600 dark:text-neutral-300">
        <span className="font-medium">{turn.currentUserName}</span>&apos;s turn to pick
      </span>
      <button onClick={passTurn} disabled={passing}
        className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 disabled:opacity-40 flex items-center gap-1">
        Pass →
      </button>
    </div>
  )
}
