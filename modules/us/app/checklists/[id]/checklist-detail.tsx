"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { checklists, checklistItems, comments } from "@/db/schema"

type Checklist = typeof checklists.$inferSelect
type Item = typeof checklistItems.$inferSelect
type Comment = typeof comments.$inferSelect

export default function ChecklistDetail({
  checklist,
  initialItems,
  initialComments,
}: {
  checklist: Checklist
  initialItems: Item[]
  initialComments: Comment[]
}) {
  const [items, setItems] = useState(initialItems)
  const [commentList, setCommentList] = useState(initialComments)
  const [newItemText, setNewItemText] = useState("")
  const [commentBody, setCommentBody] = useState("")
  const [adding, setAdding] = useState(false)
  const [commenting, setCommenting] = useState(false)
  const router = useRouter()

  const base = `/us/api/checklists/${checklist.id}`

  async function toggleItem(item: Item) {
    const res = await fetch(`${base}/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !item.completed }),
    })
    if (res.ok) {
      const updated = await res.json() as Item
      setItems((prev) => prev.map((i) => i.id === item.id ? updated : i))
    }
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newItemText.trim()) return
    setAdding(true)
    const res = await fetch(`${base}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newItemText }),
    })
    if (res.ok) {
      const item = await res.json() as Item
      setItems((prev) => [...prev, item])
      setNewItemText("")
    }
    setAdding(false)
  }

  async function deleteItem(itemId: string) {
    await fetch(`${base}/items/${itemId}`, { method: "DELETE" })
    setItems((prev) => prev.filter((i) => i.id !== itemId))
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentBody.trim()) return
    setCommenting(true)
    const res = await fetch("/us/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemType: "checklist-item", itemId: checklist.id, body: commentBody }),
    })
    if (res.ok) {
      const c = await res.json() as Comment
      setCommentList((prev) => [...prev, c])
      setCommentBody("")
    }
    setCommenting(false)
  }

  async function archiveChecklist() {
    await fetch(base, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived: !checklist.isArchived }),
    })
    router.push("/checklists")
  }

  async function togglePin() {
    await fetch(base, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPinned: !checklist.isPinned }),
    })
    router.refresh()
  }

  async function duplicateChecklist() {
    const res = await fetch(`${base}/duplicate`, { method: "POST" })
    if (res.ok) {
      const newCl = await res.json() as { id: string }
      router.push(`/checklists/${newCl.id}`)
    }
  }

  const done = items.filter((i) => i.completed)
  const remaining = items.filter((i) => !i.completed)

  return (
    <div className="space-y-6">
      {/* Actions bar */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={togglePin} className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
          {checklist.isPinned ? "Unpin" : "Pin"}
        </button>
        <button onClick={duplicateChecklist} className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
          Duplicate
        </button>
        <button onClick={archiveChecklist} className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ml-auto">
          {checklist.isArchived ? "Unarchive" : "Archive"}
        </button>
      </div>

      {/* Add item */}
      <form onSubmit={addItem} className="flex gap-2">
        <input
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          placeholder="Add item…"
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500"
        />
        <button type="submit" disabled={adding || !newItemText.trim()}
          className="px-4 py-2 text-sm rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium disabled:opacity-40 hover:opacity-90 transition-opacity">
          Add
        </button>
      </form>

      {/* Remaining items */}
      {remaining.length > 0 && (
        <ul className="space-y-1">
          {remaining.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2 group">
              <button
                onClick={() => toggleItem(item)}
                className="w-5 h-5 rounded-full border-2 border-neutral-300 dark:border-neutral-600 shrink-0 hover:border-neutral-500 dark:hover:border-neutral-400 transition-colors"
                aria-label="Complete"
              />
              <span className="flex-1 text-sm">{item.text}</span>
              <button
                onClick={() => deleteItem(item.id)}
                className="text-neutral-300 dark:text-neutral-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-xs"
                aria-label="Delete"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Done items */}
      {done.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-400 dark:text-neutral-500 mb-2">Done ({done.length})</p>
          <ul className="space-y-1">
            {done.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-1.5 group">
                <button
                  onClick={() => toggleItem(item)}
                  className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-700 border-2 border-neutral-200 dark:border-neutral-700 shrink-0 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-600 transition-colors"
                  aria-label="Uncomplete"
                >
                  <span className="text-[10px]">✓</span>
                </button>
                <span className="flex-1 text-sm text-neutral-400 dark:text-neutral-500 line-through">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {items.length === 0 && (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">Nothing here yet. Add the first item above.</p>
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
        <form onSubmit={addComment} className="flex gap-2 mt-2">
          <input
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder="Add a note…"
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500"
          />
          <button type="submit" disabled={commenting || !commentBody.trim()}
            className="px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
            Post
          </button>
        </form>
      </div>
    </div>
  )
}
