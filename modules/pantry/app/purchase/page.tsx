"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type PurchaseItem = { name: string; quantity: string; unit: string; unitPrice: string }

const EMPTY_ITEM: PurchaseItem = { name: "", quantity: "", unit: "", unitPrice: "" }

export default function PurchasePage() {
  const router = useRouter()
  const [items, setItems] = useState<PurchaseItem[]>([{ ...EMPTY_ITEM }])
  const [totalCost, setTotalCost] = useState("")
  const [currency, setCurrency] = useState("RWF")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  function updateItem(i: number, field: keyof PurchaseItem, value: string) {
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    const validItems = items.filter((i) => i.name.trim() && i.quantity && i.unit)
    if (validItems.length === 0) { setError("Add at least one item with name, quantity, and unit."); return }

    setLoading(true)
    try {
      const res = await fetch("/pantry/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: validItems.map((i) => ({
            name: i.name.trim(),
            quantity: parseFloat(i.quantity),
            unit: i.unit.trim(),
            unitPrice: parseFloat(i.unitPrice) || 0,
          })),
          totalCost: totalCost ? parseFloat(totalCost) : undefined,
          currency,
        }),
      })
      if (!res.ok) { const b = await res.json(); setError(b.error ?? "Failed"); return }
      router.push("/pantry")
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-lg font-semibold mb-6">Log Purchase</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_70px_80px_32px] gap-2 items-center">
              <input
                value={item.name} onChange={(e) => updateItem(i, "name", e.target.value)}
                placeholder="Ingredient" required={i === 0}
                className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neutral-500"
              />
              <input
                value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)}
                type="number" step="any" min="0" placeholder="Qty"
                className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-neutral-500"
              />
              <input
                value={item.unit} onChange={(e) => updateItem(i, "unit", e.target.value)}
                placeholder="Unit" list="units"
                className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-neutral-500"
              />
              <input
                value={item.unitPrice} onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                type="number" step="any" min="0" placeholder="$/unit"
                className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-neutral-500"
              />
              <button
                type="button"
                onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))}
                className="text-neutral-600 hover:text-red-400 transition-colors text-sm"
              >✕</button>
            </div>
          ))}
        </div>

        <datalist id="units">
          {["g", "kg", "ml", "l", "pcs", "cup", "tbsp", "tsp", "oz", "lb"].map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>

        <button
          type="button"
          onClick={() => setItems((p) => [...p, { ...EMPTY_ITEM }])}
          className="text-sm text-neutral-500 hover:text-neutral-100 transition-colors"
        >
          + Add item
        </button>

        <div className="flex gap-3 items-end pt-2 border-t border-neutral-800">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Total cost (optional)</label>
            <input
              value={totalCost} onChange={(e) => setTotalCost(e.target.value)}
              type="number" step="any" min="0" placeholder="0.00"
              className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:border-neutral-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Currency</label>
            <input
              value={currency} onChange={(e) => setCurrency(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm w-20 focus:outline-none focus:border-neutral-500"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit" disabled={loading}
            className="px-4 py-2 bg-neutral-100 text-neutral-900 rounded-lg text-sm font-medium hover:bg-white transition-colors disabled:opacity-40"
          >
            {loading ? "Saving…" : "Save purchase"}
          </button>
          <a href="/pantry" className="px-4 py-2 text-sm text-neutral-500 hover:text-neutral-100 transition-colors">
            Cancel
          </a>
        </div>
      </form>
    </div>
  )
}
