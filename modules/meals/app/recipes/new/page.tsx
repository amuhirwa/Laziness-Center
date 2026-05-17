"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Ingredient, Step } from "@/db/schema"

export default function NewRecipePage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [timeMinutes, setTimeMinutes] = useState("")
  const [servingsDefault, setServingsDefault] = useState("2")
  const [difficulty, setDifficulty] = useState<"" | "easy" | "medium" | "hard">("")
  const [mealTypes, setMealTypes] = useState<string[]>([])
  const [tags, setTags] = useState("")
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: "", quantity: null, unit: null }])
  const [steps, setSteps] = useState<Step[]>([{ text: "" }])
  const [sourceUrl, setSourceUrl] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  function updateIngredient(i: number, field: keyof Ingredient, value: string) {
    setIngredients((prev) => prev.map((ing, idx) =>
      idx === i ? { ...ing, [field]: field === "quantity" ? (parseFloat(value) || null) : value || null } : ing
    ))
  }

  function updateStep(i: number, value: string) {
    setSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, text: value } : s))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(""); setLoading(true)
    try {
      const res = await fetch("/meals/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          timeMinutes: timeMinutes ? parseInt(timeMinutes) : undefined,
          servingsDefault: parseInt(servingsDefault),
          difficulty: difficulty || undefined,
          mealTypes,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          ingredients: ingredients.filter((i) => i.name.trim()),
          steps: steps.filter((s) => s.text.trim()),
          sourceUrl: sourceUrl || undefined,
        }),
      })
      if (!res.ok) { const b = await res.json(); setError(b.error ?? "Failed"); return }
      const data = await res.json() as { recipeId: string }
      router.push(`/meals/recipes/${data.recipeId}`)
    } catch (err) { setError(String(err)) }
    finally { setLoading(false) }
  }

  const MEAL_TYPES = ["breakfast", "lunch", "dinner"]

  return (
    <div className="max-w-lg">
      <h1 className="text-lg font-semibold mb-6">Add Recipe</h1>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required
            className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neutral-500" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Time (min)</label>
            <input value={timeMinutes} onChange={(e) => setTimeMinutes(e.target.value)} type="number" min="1"
              className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neutral-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Servings</label>
            <input value={servingsDefault} onChange={(e) => setServingsDefault(e.target.value)} type="number" min="1"
              className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neutral-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
              className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neutral-500">
              <option value="">—</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">Meal types</label>
          <div className="flex gap-3">
            {MEAL_TYPES.map((t) => (
              <label key={t} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="checkbox" checked={mealTypes.includes(t)}
                  onChange={(e) => setMealTypes((prev) => e.target.checked ? [...prev, t] : prev.filter((x) => x !== t))}
                  className="accent-neutral-100" />
                <span className="capitalize text-neutral-400">{t}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">Tags (comma-separated)</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="thai, quick, vegetarian"
            className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neutral-500" />
        </div>

        {/* Ingredients */}
        <div className="flex flex-col gap-2">
          <label className="text-xs text-neutral-500">Ingredients</label>
          {ingredients.map((ing, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_70px_24px] gap-2 items-center">
              <input value={ing.name} onChange={(e) => updateIngredient(i, "name", e.target.value)}
                placeholder="Ingredient"
                className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-neutral-500" />
              <input value={ing.quantity ?? ""} onChange={(e) => updateIngredient(i, "quantity", e.target.value)}
                type="number" step="any" placeholder="Qty"
                className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-neutral-500" />
              <input value={ing.unit ?? ""} onChange={(e) => updateIngredient(i, "unit", e.target.value)}
                placeholder="Unit" list="units"
                className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-neutral-500" />
              <button type="button" onClick={() => setIngredients((p) => p.filter((_, idx) => idx !== i))}
                className="text-neutral-600 hover:text-red-400 text-sm">✕</button>
            </div>
          ))}
          <datalist id="units">
            {["g","kg","ml","l","pcs","cup","tbsp","tsp","oz","lb"].map((u) => <option key={u} value={u} />)}
          </datalist>
          <button type="button" onClick={() => setIngredients((p) => [...p, { name: "", quantity: null, unit: null }])}
            className="text-xs text-neutral-500 hover:text-neutral-100 text-left">+ Add ingredient</button>
        </div>

        {/* Steps */}
        <div className="flex flex-col gap-2">
          <label className="text-xs text-neutral-500">Steps</label>
          {steps.map((step, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-xs text-neutral-600 mt-2.5 w-4 shrink-0">{i + 1}.</span>
              <textarea value={step.text} onChange={(e) => updateStep(i, e.target.value)}
                rows={2} placeholder={`Step ${i + 1}`}
                className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-neutral-500 resize-none" />
              <button type="button" onClick={() => setSteps((p) => p.filter((_, idx) => idx !== i))}
                className="text-neutral-600 hover:text-red-400 text-sm mt-1.5">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setSteps((p) => [...p, { text: "" }])}
            className="text-xs text-neutral-500 hover:text-neutral-100 text-left">+ Add step</button>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">Source URL (optional)</label>
          <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} type="url"
            className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neutral-500" />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading || !name.trim()}
            className="px-4 py-2 bg-neutral-100 text-neutral-900 rounded-lg text-sm font-medium hover:bg-white disabled:opacity-40">
            {loading ? "Saving…" : "Save recipe"}
          </button>
          <button type="button" onClick={() => router.back()}
            className="text-sm text-neutral-500 hover:text-neutral-100">Cancel</button>
        </div>
      </form>
    </div>
  )
}
