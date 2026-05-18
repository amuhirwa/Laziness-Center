"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type Item = {
  id: number
  nameDisplay: string
  nameNormalized: string
  quantity: string
  unit: string
  alwaysAvailable: boolean
  lastUpdated: string
}

const inputSm = "bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-neutral-500"

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editQty, setEditQty] = useState("")
  const [addName, setAddName] = useState("")
  const [addUnit, setAddUnit] = useState("pcs")
  const [addAlways, setAddAlways] = useState(true)
  const [addError, setAddError] = useState("")

  async function load() {
    const res = await fetch("/pantry/api/inventory")
    const data = await res.json() as { items: Item[] }
    setItems(data.items)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function saveQty(item: Item) {
    const qty = parseFloat(editQty)
    if (isNaN(qty) || qty < 0) { setEditingId(null); return }
    await fetch(`/pantry/api/inventory/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: qty }),
    })
    setEditingId(null)
    load()
  }

  async function markOut(item: Item) {
    await fetch(`/pantry/api/inventory/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: 0 }),
    })
    load()
  }

  async function toggleAlways(item: Item) {
    await fetch(`/pantry/api/inventory/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alwaysAvailable: !item.alwaysAvailable }),
    })
    load()
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    setAddError("")
    if (!addName.trim()) return
    const res = await fetch("/pantry/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: addName.trim(), unit: addUnit, alwaysAvailable: addAlways }),
    })
    if (!res.ok) { const b = await res.json(); setAddError(b.error ?? "Failed"); return }
    setAddName(""); setAddUnit("pcs"); setAddAlways(true)
    load()
  }

  const inStock = items.filter((i) => parseFloat(i.quantity) > 0)
  const staples = items.filter((i) => i.alwaysAvailable && parseFloat(i.quantity) <= 0)
  const outOfStock = items.filter((i) => !i.alwaysAvailable && parseFloat(i.quantity) <= 0)

  if (loading) return <div className="text-sm text-neutral-500">Loading…</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold">Inventory</h1>
        <Link href="/purchase"
          className="text-sm px-4 py-1.5 bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 rounded-md font-medium hover:opacity-90 transition-opacity">
          + Log purchase
        </Link>
      </div>

      {/* Add staple / item form */}
      <form onSubmit={addItem} className="flex flex-wrap gap-2 mb-6 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
        <input value={addName} onChange={(e) => setAddName(e.target.value)}
          placeholder="Item name (e.g. eggs)" className={`flex-1 min-w-32 ${inputSm}`} />
        <input value={addUnit} onChange={(e) => setAddUnit(e.target.value)}
          placeholder="Unit" className={`${inputSm} w-20`} />
        <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none text-neutral-600 dark:text-neutral-400">
          <input type="checkbox" checked={addAlways} onChange={(e) => setAddAlways(e.target.checked)}
            className="accent-neutral-600 dark:accent-neutral-400" />
          Always available
        </label>
        <button type="submit"
          className="px-3 py-1 bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 rounded-md text-sm font-medium hover:opacity-90">
          Add
        </button>
        {addError && <p className="w-full text-xs text-red-500">{addError}</p>}
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No items yet.{" "}
          <Link href="/purchase" className="underline">Log your first purchase</Link>{" "}
          or add a staple above.
        </p>
      ) : (
        <div className="space-y-6">
          {/* In stock */}
          {inStock.length > 0 && (
            <Section title="In stock" dot="bg-green-500" items={inStock}
              editingId={editingId} editQty={editQty}
              setEditingId={setEditingId} setEditQty={setEditQty}
              saveQty={saveQty} markOut={markOut} toggleAlways={toggleAlways} />
          )}

          {/* Staples */}
          {staples.length > 0 && (
            <Section title="Staples — always available" dot="bg-blue-400" items={staples}
              editingId={editingId} editQty={editQty}
              setEditingId={setEditingId} setEditQty={setEditQty}
              saveQty={saveQty} markOut={markOut} toggleAlways={toggleAlways} />
          )}

          {/* Out of stock */}
          {outOfStock.length > 0 && (
            <Section title="Out of stock" dot="bg-neutral-400 dark:bg-neutral-600" items={outOfStock}
              editingId={editingId} editQty={editQty}
              setEditingId={setEditingId} setEditQty={setEditQty}
              saveQty={saveQty} markOut={markOut} toggleAlways={toggleAlways} />
          )}
        </div>
      )}

      {/* Legend */}
      {items.length > 0 && (
        <div className="mt-6 flex gap-4 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />In stock</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400" />Staple</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-neutral-400 dark:bg-neutral-600" />Out</span>
        </div>
      )}
    </div>
  )
}

function Section({ title, dot, items, editingId, editQty, setEditingId, setEditQty, saveQty, markOut, toggleAlways }: {
  title: string; dot: string; items: Item[]
  editingId: number | null; editQty: string
  setEditingId: (id: number | null) => void
  setEditQty: (q: string) => void
  saveQty: (item: Item) => void
  markOut: (item: Item) => void
  toggleAlways: (item: Item) => void
}) {
  return (
    <div>
      <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2 flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{title} ({items.length})
      </h2>
      <div className="space-y-px">
        {items.map((item) => (
          <div key={item.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors group">

            {/* Name */}
            <span className="flex-1 text-sm">{item.nameDisplay}</span>

            {/* Quantity — click to edit */}
            {editingId === item.id ? (
              <input
                autoFocus
                value={editQty}
                onChange={(e) => setEditQty(e.target.value)}
                onBlur={() => saveQty(item)}
                onKeyDown={(e) => { if (e.key === "Enter") saveQty(item); if (e.key === "Escape") setEditingId(null) }}
                className="w-20 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded px-2 py-0.5 text-sm text-right focus:outline-none"
              />
            ) : (
              <button
                onClick={() => { setEditingId(item.id); setEditQty(parseFloat(item.quantity).toString()) }}
                className="text-sm font-mono text-right w-20 hover:text-neutral-500 transition-colors"
                title="Click to edit quantity"
              >
                {parseFloat(item.quantity) > 0 ? parseFloat(item.quantity).toLocaleString() : "—"} <span className="text-neutral-400 dark:text-neutral-600 text-xs">{item.unit}</span>
              </button>
            )}

            {/* Controls — visible on hover */}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              {parseFloat(item.quantity) > 0 && (
                <button onClick={() => markOut(item)}
                  title="Mark as out of stock"
                  className="px-2 py-1 text-xs text-neutral-500 hover:text-red-500 transition-colors rounded">
                  Out
                </button>
              )}
              <button onClick={() => toggleAlways(item)}
                title={item.alwaysAvailable ? "Remove from staples" : "Mark as always available"}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  item.alwaysAvailable
                    ? "text-blue-500 hover:text-neutral-500"
                    : "text-neutral-400 hover:text-blue-500"
                }`}>
                {item.alwaysAvailable ? "★ staple" : "staple"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
