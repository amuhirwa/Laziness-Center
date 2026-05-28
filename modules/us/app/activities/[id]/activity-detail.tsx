"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { activities, reactions, comments } from "@/db/schema"

type Activity = typeof activities.$inferSelect
type Reaction = typeof reactions.$inferSelect
type Comment = typeof comments.$inferSelect

const STATUSES = ["wantToDo", "done", "skipped"] as const
const STATUS_LABELS: Record<string, string> = { wantToDo: "Want to do", done: "Done", skipped: "Skipped" }
const LINKED_LABELS: Record<string, string> = { place: "📍 Place", wishlist: "🛍 Wishlist item", recipe: "🍳 Recipe" }

export default function ActivityDetail({
  item: initial,
  reactions: initialReactions,
  initialComments,
  hasReacted,
  linkedName,
}: {
  item: Activity
  reactions: Reaction[]
  initialComments: Comment[]
  hasReacted: boolean
  linkedName: string | null
}) {
  const [item, setItem] = useState(initial)
  const [reacted, setReacted] = useState(hasReacted)
  const [reactCount, setReactCount] = useState(initialReactions.length)
  const [commentList, setCommentList] = useState(initialComments)
  const [commentBody, setCommentBody] = useState("")
  const [commenting, setCommenting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(item.title)
  const [editDesc, setEditDesc] = useState(item.description ?? "")
  const router = useRouter()

  const base = `/us/api/activities/${item.id}`

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
    if (res.ok) setItem(await res.json() as Activity)
  }

  async function togglePin() {
    const res = await fetch(base, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPinned: !item.isPinned }),
    })
    if (res.ok) setItem(await res.json() as Activity)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch(base, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle, description: editDesc }),
    })
    if (res.ok) {
      setItem(await res.json() as Activity)
      setEditing(false)
    }
  }

  async function deleteItem() {
    await fetch(base, { method: "DELETE" })
    router.push("/activities")
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentBody.trim()) return
    setCommenting(true)
    const res = await fetch("/us/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemType: "activity", itemId: item.id, body: commentBody }),
    })
    if (res.ok) {
      const c = await res.json() as Comment
      setCommentList((prev) => [...prev, c])
      setCommentBody("")
    }
    setCommenting(false)
  }

  const linkedHref = item.linkedType === "place" ? `/places/${item.linkedId}`
    : item.linkedType === "wishlist" ? `/wishlists/${item.linkedId}`
    : item.linkedType === "recipe" ? item.linkedUrl ?? null
    : null

  return (
    <div className="space-y-5">
      {editing ? (
        <form onSubmit={saveEdit} className="space-y-3">
          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400" />
          <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3}
            placeholder="Description…"
            className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400 resize-none" />
          <div className="flex gap-2">
            <button type="submit" className="text-sm px-4 py-1.5 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium hover:opacity-90">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="text-sm px-4 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700">Cancel</button>
          </div>
        </form>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-semibold text-lg leading-tight">{item.title}</h2>
            <div className="flex gap-2 shrink-0">
              <button onClick={togglePin} className="text-xs text-neutral-400 hover:text-yellow-500">{item.isPinned ? "★" : "☆"}</button>
              <button onClick={() => setEditing(true)} className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">Edit</button>
              <button onClick={deleteItem} className="text-xs text-neutral-400 hover:text-red-500">Delete</button>
            </div>
          </div>
          {item.category && <p className="text-xs text-neutral-400 capitalize mt-0.5">{item.category}</p>}
          {item.description && <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{item.description}</p>}
        </div>
      )}

      {/* Linked item */}
      {item.linkedType && linkedHref && (
        <a href={linkedHref} target={item.linkedType === "recipe" ? "_blank" : undefined}
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-sm hover:border-blue-400 transition-colors">
          <span className="text-blue-500">{LINKED_LABELS[item.linkedType] ?? "🔗"}</span>
          <span className="text-blue-600 dark:text-blue-400 font-medium">{linkedName ?? item.linkedUrl ?? "View →"}</span>
          <span className="ml-auto text-blue-400 text-xs">→</span>
        </a>
      )}

      {/* Reaction + status */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={toggleReact}
          className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${
            reacted
              ? "border-pink-400 text-pink-500 bg-pink-50 dark:bg-pink-900/20"
              : "border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:border-pink-300 dark:hover:border-pink-700"
          }`}>
          {reacted ? "♡ Want to do too" : "♡ I want to do this too"}
          {reactCount > 0 && <span className="text-xs">({reactCount})</span>}
        </button>

        <select value={item.status} onChange={(e) => changeStatus(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>

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
          <input value={commentBody} onChange={(e) => setCommentBody(e.target.value)}
            placeholder="Add a comment…"
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500" />
          <button type="submit" disabled={commenting || !commentBody.trim()}
            className="px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
            Post
          </button>
        </form>
      </div>
    </div>
  )
}
