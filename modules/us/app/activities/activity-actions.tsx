"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const CATEGORIES = ["game", "cooking", "movie", "show", "sport", "music", "outdoor", "other"] as const

export default function ActivityActions() {
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [showMore, setShowMore] = useState(false)
  const [linkType, setLinkType] = useState<"" | "recipe">("")
  const [linkUrl, setLinkUrl] = useState("")
  const [pending, setPending] = useState(false)
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setPending(true)
    const res = await fetch("/us/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || undefined,
        category: category || undefined,
        linkedType: linkType === "recipe" ? "recipe" : undefined,
        linkedUrl: linkType === "recipe" && linkUrl ? linkUrl : undefined,
      }),
    })
    if (res.ok) {
      setTitle("")
      setDescription("")
      setCategory("")
      setLinkType("")
      setLinkUrl("")
      setShowMore(false)
      router.refresh()
    }
    setPending(false)
  }

  const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500"

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="New activity…"
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500" />
        <button type="submit" disabled={pending || !title.trim()}
          className="px-4 py-2 text-sm rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium disabled:opacity-40 hover:opacity-90 transition-opacity">
          Add
        </button>
      </div>

      <button type="button" onClick={() => setShowMore(!showMore)}
        className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">
        {showMore ? "▾" : "▸"} Category &amp; details
      </button>

      {showMore && (
        <div className="space-y-2 pt-1">
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map((c) => (
              <button type="button" key={c} onClick={() => setCategory(category === c ? "" : c)}
                className={`text-xs px-3 py-1 rounded-full capitalize transition-colors ${category === c ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900" : "border border-neutral-200 dark:border-neutral-700 text-neutral-500"}`}>
                {c}
              </button>
            ))}
          </div>

          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
            placeholder="Notes…"
            className={`${inputCls} resize-none`} />

          <div>
            <label className="text-xs text-neutral-400 dark:text-neutral-500 block mb-1">Link to recipe (optional)</label>
            <input value={linkUrl} onChange={(e) => { setLinkUrl(e.target.value); setLinkType(e.target.value ? "recipe" : "") }}
              placeholder="/meals/recipes/… or paste a recipe URL"
              className={inputCls} />
          </div>
        </div>
      )}
    </form>
  )
}
