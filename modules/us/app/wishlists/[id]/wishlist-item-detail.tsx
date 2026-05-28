"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { wishlistItems, reactions, comments } from "@/db/schema"

type Item = typeof wishlistItems.$inferSelect
type Reaction = typeof reactions.$inferSelect
type Comment = typeof comments.$inferSelect

const STATUSES = ["wanted", "bought", "received", "passed"] as const

export default function WishlistItemDetail({
  item: initial,
  reactions: initialReactions,
  initialComments,
  hasReacted,
  currentUserId,
  partnerEmail,
}: {
  item: Item
  reactions: Reaction[]
  initialComments: Comment[]
  hasReacted: boolean
  currentUserId: string
  partnerEmail: string | null
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

  const isOwner = item.addedBy === currentUserId
  const isHidden = !!item.hiddenFrom
  const partnerName = partnerEmail?.split("@")[0]

  async function toggleSurprise() {
    // When hiding, use partnerEmail if known, otherwise a sentinel that no real email matches.
    // The API filters by: show if hidden_from IS NULL OR added_by = current_user.
    const newVal = isHidden ? null : (partnerEmail ?? "__hidden__")
    const res = await fetch(base, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hiddenFrom: newVal }),
    })
    if (res.ok) setItem(await res.json() as Item)
  }

  const base = `/us/api/wishlist/${item.id}`

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
    if (res.ok) {
      const updated = await res.json() as Item
      setItem(updated)
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch(base, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle, description: editDesc }),
    })
    if (res.ok) {
      const updated = await res.json() as Item
      setItem(updated)
      setEditing(false)
    }
  }

  async function deleteItem() {
    await fetch(base, { method: "DELETE" })
    router.push("/wishlists")
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentBody.trim()) return
    setCommenting(true)
    const res = await fetch("/us/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemType: "wishlist", itemId: item.id, body: commentBody }),
    })
    if (res.ok) {
      const c = await res.json() as Comment
      setCommentList((prev) => [...prev, c])
      setCommentBody("")
    }
    setCommenting(false)
  }

  return (
    <div className="space-y-5">
      {item.imageUrl && (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.imageUrl} alt={item.title} className="w-full h-52 object-cover rounded-xl" />
          {item.extraImages && item.extraImages.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {item.extraImages.map((img, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={img} alt="" className="w-20 h-20 object-cover rounded-lg shrink-0" />
              ))}
            </div>
          )}
        </div>
      )}

      {editing ? (
        <form onSubmit={saveEdit} className="space-y-3">
          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400" />
          <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3}
            placeholder="Description…"
            className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400 resize-none" />
          <div className="flex gap-2">
            <button type="submit" className="text-sm px-4 py-1.5 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium hover:opacity-90">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="text-sm px-4 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800">Cancel</button>
          </div>
        </form>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-semibold text-lg leading-tight">{item.title}</h2>
            <div className="flex gap-2 shrink-0 flex-wrap justify-end">
              {isOwner && (
                <button onClick={toggleSurprise}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${isHidden ? "border-pink-300 text-pink-500 bg-pink-50 dark:bg-pink-900/20" : "border-neutral-200 dark:border-neutral-700 text-neutral-400"}`}>
                  {isHidden ? `🎁 Hidden${partnerName ? ` from ${partnerName}` : ""}` : "🎁 Surprise mode"}
                </button>
              )}
              <button onClick={() => setEditing(true)} className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">Edit</button>
              <button onClick={deleteItem} className="text-xs text-neutral-400 hover:text-red-500">Delete</button>
            </div>
          </div>
          {item.description && <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{item.description}</p>}
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:underline mt-1 block truncate">{item.url}</a>
          )}
          {item.price && (
            <p className="text-sm mt-1 font-medium">{item.currency ?? ""} {item.price}</p>
          )}
        </div>
      )}

      {/* Reaction + status */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={toggleReact}
          className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${
            reacted
              ? "border-pink-400 text-pink-500 bg-pink-50 dark:bg-pink-900/20"
              : "border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:border-pink-300 dark:hover:border-pink-700"
          }`}>
          {reacted ? "♡ Want this too" : "♡ I want this too"}
          {reactCount > 0 && <span className="text-xs">({reactCount})</span>}
        </button>

        <select value={item.status} onChange={(e) => changeStatus(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 capitalize">
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
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
