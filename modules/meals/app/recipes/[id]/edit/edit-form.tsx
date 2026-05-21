"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { Ingredient, Step } from "@/db/schema"

const inputCls = "bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neutral-500"
const inputSmCls = "bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-neutral-500"

export default function EditRecipeForm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [name, setName] = useState("")
  const [timeMinutes, setTimeMinutes] = useState("")
  const [servingsDefault, setServingsDefault] = useState("2")
  const [difficulty, setDifficulty] = useState<"" | "easy" | "medium" | "hard">("")
  const [mealTypes, setMealTypes] = useState<string[]>([])
  const [tags, setTags] = useState("")
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [steps, setSteps] = useState<Step[]>([])
  const [sourceUrl, setSourceUrl] = useState("")
  const [thumbnailUrl, setThumbnailUrl] = useState("")

  useEffect(() => {
    fetch(`/meals/api/recipes/${id}`)
      .then((r) => r.json())
      .then((data: {
        name: string; timeMinutes: number | null; servingsDefault: number
        difficulty: string | null; mealTypes: string[]; tags: string[]
        ingredients: Ingredient[]; steps: Step[]; sourceUrl: string | null
        thumbnailUrl: string | null
      }) => {
        setName(data.name)
        setTimeMinutes(data.timeMinutes != null ? String(data.timeMinutes) : "")
        setServingsDefault(String(data.servingsDefault))
        setDifficulty((data.difficulty as typeof difficulty) ?? "")
        setMealTypes(data.mealTypes ?? [])
        setTags((data.tags ?? []).join(", "))
        setIngredients(data.ingredients?.length ? data.ingredients : [{ name: "", quantity: null, unit: null }])
        setSteps(data.steps?.length ? data.steps : [{ text: "" }])
        setSourceUrl(data.sourceUrl ?? "")
        setThumbnailUrl(data.thumbnailUrl ?? "")
      })
      .finally(() => setLoading(false))
  }, [id])

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
    setError(""); setSaving(true)
    try {
      const res = await fetch(`/meals/api/recipes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          timeMinutes: timeMinutes ? parseInt(timeMinutes) : null,
          servingsDefault: parseInt(servingsDefault),
          difficulty: difficulty || null,
          mealTypes,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          ingredients: ingredients.filter((i) => i.name.trim()),
          steps: steps.filter((s) => s.text.trim()),
          sourceUrl: sourceUrl || null,
          thumbnailUrl: thumbnailUrl || null,
        }),
      })
      if (!res.ok) { const b = await res.json(); setError(b.error ?? "Failed"); return }
      router.push(`/recipes/${id}`)
    } catch (err) { setError(String(err)) }
    finally { setSaving(false) }
  }

  if (loading) return <div className="text-sm text-neutral-500">Loading…</div>

  const MEAL_TYPES = ["breakfast", "lunch", "dinner"]

  return (
    <div className="max-w-lg">
      <h1 className="text-lg font-semibold mb-6">Edit Recipe</h1>
      <form onSubmit={handleSubmit} className="space-y-5">

        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Time (min)</label>
            <input value={timeMinutes} onChange={(e) => setTimeMinutes(e.target.value)} type="number" min="1" className={inputCls} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Servings</label>
            <input value={servingsDefault} onChange={(e) => setServingsDefault(e.target.value)} type="number" min="1" className={inputCls} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)} className={inputCls}>
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
                  className="accent-neutral-600 dark:accent-neutral-400" />
                <span className="capitalize text-neutral-600 dark:text-neutral-400">{t}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">Tags (comma-separated)</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="thai, quick, vegetarian" className={inputCls} />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-neutral-500">Ingredients</label>
          {ingredients.map((ing, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_70px_24px] gap-2 items-center">
              <input value={ing.name} onChange={(e) => updateIngredient(i, "name", e.target.value)} placeholder="Ingredient" className={inputSmCls} />
              <input value={ing.quantity ?? ""} onChange={(e) => updateIngredient(i, "quantity", e.target.value)} type="number" step="any" placeholder="Qty" className={inputSmCls} />
              <input value={ing.unit ?? ""} onChange={(e) => updateIngredient(i, "unit", e.target.value)} placeholder="Unit" list="units" className={inputSmCls} />
              <button type="button" onClick={() => setIngredients((p) => p.filter((_, idx) => idx !== i))}
                className="text-neutral-400 hover:text-red-500 text-sm">✕</button>
            </div>
          ))}
          <datalist id="units">
            {["g","kg","ml","l","pcs","cup","tbsp","tsp","oz","lb"].map((u) => <option key={u} value={u} />)}
          </datalist>
          <button type="button" onClick={() => setIngredients((p) => [...p, { name: "", quantity: null, unit: null }])}
            className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 text-left">+ Add ingredient</button>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-neutral-500">Steps</label>
          {steps.map((step, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-xs text-neutral-500 mt-2.5 w-4 shrink-0">{i + 1}.</span>
              <textarea value={step.text} onChange={(e) => updateStep(i, e.target.value)}
                rows={2} placeholder={`Step ${i + 1}`}
                className={`flex-1 ${inputSmCls} resize-none`} />
              <button type="button" onClick={() => setSteps((p) => p.filter((_, idx) => idx !== i))}
                className="text-neutral-400 hover:text-red-500 text-sm mt-1.5">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setSteps((p) => [...p, { text: "" }])}
            className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 text-left">+ Add step</button>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">Source URL (optional)</label>
          <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} type="url" className={inputCls} />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-neutral-500">Thumbnail URL (optional)</label>
          <input value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} type="url"
            placeholder="https://…" className={inputCls} />
          {thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnailUrl} alt="thumbnail preview"
              className="w-full h-40 object-cover rounded-lg" />
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving || !name.trim()}
            className="px-4 py-2 bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40">
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button type="button" onClick={() => router.back()}
            className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">Cancel</button>
        </div>
      </form>
    </div>
  )
}
