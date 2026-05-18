"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { ImportedRecipe } from "@/lib/import"

const inputCls = "bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neutral-500"
const btnPrimary = "px-4 py-2 bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"

export default function ImportPage() {
  const router = useRouter()
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<ImportedRecipe | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleFetch(e: React.FormEvent) {
    e.preventDefault()
    setError(""); setPreview(null); setLoading(true)
    try {
      const res = await fetch("/meals/api/recipes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
      const data = await res.json() as { recipe?: ImportedRecipe; error?: string; pageTitle?: string }
      if (!res.ok) {
        setError(`${data.error ?? "Parse failed"}${data.pageTitle ? ` — "${data.pageTitle}"` : ""}. Fill in manually.`)
      } else {
        setPreview(data.recipe!)
      }
    } catch (err) { setError(String(err)) }
    finally { setLoading(false) }
  }

  async function handleSave() {
    if (!preview) return
    setSaving(true)
    const res = await fetch("/meals/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preview),
    })
    if (res.ok) {
      const data = await res.json() as { recipeId: string }
      router.push(`/meals/recipes/${data.recipeId}`)
    } else {
      setError("Failed to save recipe")
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-lg font-semibold mb-6">Import Recipe from URL</h1>

      <form onSubmit={handleFetch} className="flex gap-2 mb-6">
        <input
          value={url} onChange={(e) => setUrl(e.target.value)}
          type="url" required placeholder="https://..."
          className={`flex-1 ${inputCls}`}
        />
        <button type="submit" disabled={loading} className={btnPrimary}>
          {loading ? "Fetching…" : "Fetch"}
        </button>
      </form>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {preview && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 space-y-3 text-sm">
            <div>
              <span className="text-neutral-500">Name: </span>
              <span className="font-medium">{preview.name}</span>
            </div>
            {preview.timeMinutes && (
              <div><span className="text-neutral-500">Time: </span>{preview.timeMinutes} min</div>
            )}
            {preview.servingsDefault && (
              <div><span className="text-neutral-500">Servings: </span>{preview.servingsDefault}</div>
            )}
            {preview.ingredients && preview.ingredients.length > 0 && (
              <div>
                <span className="text-neutral-500 block mb-1">Ingredients ({preview.ingredients.length}):</span>
                <ul className="space-y-0.5 ml-2">
                  {preview.ingredients.slice(0, 6).map((i, idx) => (
                    <li key={idx} className="text-neutral-600 dark:text-neutral-400">
                      {i.quantity != null && `${i.quantity} `}{i.unit && `${i.unit} `}{i.name}
                    </li>
                  ))}
                  {preview.ingredients.length > 6 && (
                    <li className="text-neutral-400 dark:text-neutral-600">… {preview.ingredients.length - 6} more</li>
                  )}
                </ul>
              </div>
            )}
            {preview.steps && (
              <div>
                <span className="text-neutral-500">{preview.steps.length} step{preview.steps.length !== 1 ? "s" : ""}</span>
                {!preview.hasStructuredSteps && preview.steps.length === 1 && (
                  <span className="text-neutral-400 dark:text-neutral-600 ml-1">(blob — you can restructure manually)</span>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className={btnPrimary}>
              {saving ? "Saving…" : "Save recipe"}
            </button>
            <button onClick={() => setPreview(null)}
              className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
              Try a different URL
            </button>
          </div>
          <p className="text-xs text-neutral-400 dark:text-neutral-600">You can edit the recipe after saving.</p>
        </div>
      )}
    </div>
  )
}
