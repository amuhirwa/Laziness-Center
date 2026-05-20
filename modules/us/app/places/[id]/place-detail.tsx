"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { places, placeVisits, reactions, comments } from "@/db/schema"

type Place = typeof places.$inferSelect
type Visit = typeof placeVisits.$inferSelect
type Reaction = typeof reactions.$inferSelect
type Comment = typeof comments.$inferSelect

const STATUS_LABELS: Record<string, string> = { wantToGo: "Want to go", visited: "Visited", passed: "Passed" }
const STATUSES = ["wantToGo", "visited", "passed"]

export default function PlaceDetail({
  place: initial,
  visits: initialVisits,
  reactions: initialReactions,
  initialComments,
  hasReacted,
}: {
  place: Place
  visits: Visit[]
  reactions: Reaction[]
  initialComments: Comment[]
  hasReacted: boolean
}) {
  const [place, setPlace] = useState(initial)
  const [visits, setVisits] = useState(initialVisits)
  const [reacted, setReacted] = useState(hasReacted)
  const [reactCount, setReactCount] = useState(initialReactions.length)
  const [commentList, setCommentList] = useState(initialComments)
  const [commentBody, setCommentBody] = useState("")
  const [showVisitForm, setShowVisitForm] = useState(false)
  const [visitNotes, setVisitNotes] = useState("")
  const [visitRating, setVisitRating] = useState<number | "">("")
  const [commenting, setCommenting] = useState(false)
  const router = useRouter()

  const base = `/us/api/places/${place.id}`

  async function toggleReact() {
    const method = reacted ? "DELETE" : "POST"
    const res = await fetch(`${base}/react`, { method })
    if (res.ok) {
      setReacted(!reacted)
      setReactCount((c) => reacted ? c - 1 : c + 1)
    }
  }

  async function changeStatus(status: string) {
    const res = await fetch(base, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (res.ok) setPlace(await res.json() as Place)
  }

  async function logVisit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch(`${base}/visits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: visitRating || undefined, notes: visitNotes || undefined }),
    })
    if (res.ok) {
      const v = await res.json() as Visit
      setVisits((prev) => [v, ...prev])
      setPlace((p) => ({ ...p, status: "visited" }))
      setShowVisitForm(false)
      setVisitNotes("")
      setVisitRating("")
    }
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentBody.trim()) return
    setCommenting(true)
    const res = await fetch("/us/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemType: "place", itemId: place.id, body: commentBody }),
    })
    if (res.ok) {
      setCommentList((prev) => [...prev, await res.json() as Comment])
      setCommentBody("")
    }
    setCommenting(false)
  }

  async function deletePlace() {
    await fetch(base, { method: "DELETE" })
    router.push("/us/places")
  }

  return (
    <div className="space-y-5">
      {place.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={place.imageUrl} alt={place.name} className="w-full h-52 object-cover rounded-xl" />
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-lg">{place.name}</h2>
          {place.location && <p className="text-sm text-neutral-500 dark:text-neutral-400">{place.location}</p>}
          {place.description && <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">{place.description}</p>}
          {place.url && (
            <a href={place.url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:underline mt-1 block truncate">{place.url}</a>
          )}
          {place.category && <span className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 capitalize">{place.category}</span>}
        </div>
        <button onClick={deletePlace} className="text-xs text-neutral-400 hover:text-red-500 shrink-0">Delete</button>
      </div>

      {/* Status + react + log visit */}
      <div className="flex flex-wrap gap-2">
        <button onClick={toggleReact}
          className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${
            reacted ? "border-pink-400 text-pink-500 bg-pink-50 dark:bg-pink-900/20" : "border-neutral-200 dark:border-neutral-700 text-neutral-500"
          }`}>
          ♡ Want to go too {reactCount > 0 && `(${reactCount})`}
        </button>
        <select value={place.status} onChange={(e) => changeStatus(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <button onClick={() => setShowVisitForm(!showVisitForm)}
          className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
          + Log visit
        </button>
      </div>

      {showVisitForm && (
        <form onSubmit={logVisit} className="space-y-2 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
          <p className="text-xs font-medium">Log a visit</p>
          <div className="flex gap-2">
            {[1,2,3,4,5].map((n) => (
              <button type="button" key={n} onClick={() => setVisitRating(n === visitRating ? "" : n)}
                className={`w-8 h-8 rounded-full text-sm transition-colors ${visitRating === n ? "bg-yellow-400 text-white" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"}`}>
                {n}
              </button>
            ))}
          </div>
          <textarea value={visitNotes} onChange={(e) => setVisitNotes(e.target.value)} rows={2} placeholder="Notes… (what did you eat? was it good?)"
            className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400 resize-none" />
          <div className="flex gap-2">
            <button type="submit" className="text-sm px-4 py-1.5 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium hover:opacity-90">Save</button>
            <button type="button" onClick={() => setShowVisitForm(false)} className="text-sm px-4 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700">Cancel</button>
          </div>
        </form>
      )}

      {/* Visit log */}
      {visits.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Visits ({visits.length})</p>
          {visits.map((v) => (
            <div key={v.id} className="text-sm p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">{new Date(v.visitedAt).toLocaleDateString()}</span>
                {v.rating && <span className="text-xs text-yellow-500">{"★".repeat(v.rating)}</span>}
              </div>
              {v.notes && <p className="mt-1">{v.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Comments */}
      <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4 space-y-3">
        <p className="text-xs uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Comments</p>
        {commentList.map((c) => (
          <div key={c.id} className="text-sm">
            <span className="font-medium text-xs text-neutral-400 dark:text-neutral-500">{c.author.split("@")[0]}</span>
            <p className="mt-0.5">{c.body}</p>
          </div>
        ))}
        <form onSubmit={addComment} className="flex gap-2">
          <input value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder="Add a comment…"
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500" />
          <button type="submit" disabled={commenting || !commentBody.trim()}
            className="px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">Post</button>
        </form>
      </div>
    </div>
  )
}
