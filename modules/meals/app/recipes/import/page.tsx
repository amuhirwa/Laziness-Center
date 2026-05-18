"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { ImportedRecipe } from "@/lib/import"
import { searchMealDB, getRandomMeal, mealDBToRecipe, type MealDBMeal } from "@/lib/mealdb"

const inputCls = "bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neutral-500"
const btnPrimary = "px-4 py-2 bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"
const btnSecondary = "px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"

export default function ImportPage() {
  const router = useRouter()
  const [tab, setTab] = useState<"url" | "mealdb">("mealdb")

  return (
    <div className="max-w-lg">
      <h1 className="text-lg font-semibold mb-4">Import Recipe</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-neutral-200 dark:border-neutral-800">
        {(["mealdb", "url"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t
                ? "border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100"
                : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            {t === "mealdb" ? "Search MealDB" : "From URL"}
          </button>
        ))}
      </div>

      {tab === "mealdb" ? <MealDBTab router={router} /> : <UrlTab router={router} />}
    </div>
  )
}

// ── MealDB tab ─────────────────────────────────────────────────────────────

function MealDBTab({ router }: { router: ReturnType<typeof useRouter> }) {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<MealDBMeal[]>([])
  const [searched, setSearched] = useState(false)
  const [selected, setSelected] = useState<MealDBMeal | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true); setError(""); setResults([]); setSelected(null); setSearched(false)
    try {
      const meals = await searchMealDB(query.trim())
      setResults(meals)
      setSearched(true)
    } catch { setError("Search failed — check your connection") }
    finally { setLoading(false) }
  }

  async function handleRandom() {
    setLoading(true); setError(""); setResults([]); setSelected(null); setSearched(false)
    try {
      const meal = await getRandomMeal()
      if (meal) { setResults([meal]); setSearched(true) }
    } catch { setError("Failed to fetch random meal") }
    finally { setLoading(false) }
  }

  async function handleSave(meal: MealDBMeal) {
    setSaving(true); setError("")
    try {
      const recipe = mealDBToRecipe(meal)
      const res = await fetch("/meals/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recipe),
      })
      if (!res.ok) { setError("Failed to save"); return }
      const data = await res.json() as { recipeId: string }
      router.push(`/recipes/${data.recipeId}`)
    } catch (e) { setError(String(e)) }
    finally { setSaving(false) }
  }

  if (selected) {
    const recipe = mealDBToRecipe(selected)
    return (
      <div className="space-y-4">
        {selected.strMealThumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={selected.strMealThumb} alt={selected.strMeal}
            className="w-full h-48 object-cover rounded-xl" />
        )}
        <div className="space-y-1">
          <h2 className="font-semibold text-lg">{selected.strMeal}</h2>
          <div className="flex gap-2 text-xs text-neutral-500">
            {selected.strCategory && <span>{selected.strCategory}</span>}
            {selected.strArea && <span>· {selected.strArea}</span>}
            <span>· {recipe.ingredients.length} ingredients</span>
            <span>· {recipe.steps.length} steps</span>
          </div>
        </div>

        <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 text-sm space-y-1">
          <p className="text-xs text-neutral-500 font-medium mb-2">Ingredients</p>
          {recipe.ingredients.slice(0, 8).map((ing, i) => (
            <div key={i} className="text-neutral-700 dark:text-neutral-300">
              {ing.quantity != null && <span className="font-mono mr-1">{ing.quantity}</span>}
              {ing.unit && <span className="text-neutral-500 mr-1">{ing.unit}</span>}
              {ing.name}
            </div>
          ))}
          {recipe.ingredients.length > 8 && (
            <p className="text-xs text-neutral-400">… {recipe.ingredients.length - 8} more</p>
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3">
          <button onClick={() => handleSave(selected)} disabled={saving} className={btnPrimary}>
            {saving ? "Saving…" : "Save to my recipes"}
          </button>
          <button onClick={() => setSelected(null)} className={btnSecondary}>← Back</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a meal…" className={`flex-1 ${inputCls}`} />
        <button type="submit" disabled={loading || !query.trim()} className={btnPrimary}>
          {loading ? "…" : "Search"}
        </button>
        <button type="button" onClick={handleRandom} disabled={loading} className={btnSecondary}
          title="Random meal">
          ⟳
        </button>
      </form>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {searched && results.length === 0 && (
        <p className="text-sm text-neutral-500">No meals found for "{query}".</p>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {results.map((meal) => (
            <button key={meal.idMeal} onClick={() => setSelected(meal)}
              className="text-left rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors">
              {meal.strMealThumb && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${meal.strMealThumb}/preview`} alt={meal.strMeal}
                  className="w-full h-28 object-cover" />
              )}
              <div className="p-2.5">
                <p className="text-sm font-medium leading-snug">{meal.strMeal}</p>
                {meal.strCategory && (
                  <p className="text-xs text-neutral-500 mt-0.5">{meal.strCategory}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {!searched && (
        <p className="text-xs text-neutral-400 dark:text-neutral-600">
          Search TheMealDB's library of thousands of recipes, or hit ⟳ for a random suggestion.
        </p>
      )}
    </div>
  )
}

// ── URL tab ────────────────────────────────────────────────────────────────

function UrlTab({ router }: { router: ReturnType<typeof useRouter> }) {
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
        setError(`${data.error ?? "Parse failed"}${data.pageTitle ? ` — "${data.pageTitle}"` : ""}`)
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
      router.push(`/recipes/${data.recipeId}`)
    } else {
      setError("Failed to save recipe")
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">
        Works on sites without bot protection (Budget Bytes, Cookie and Kate, BBC Good Food, etc).
        Sites using Cloudflare (AllRecipes, Serious Eats) will return 403.
      </p>

      <form onSubmit={handleFetch} className="flex gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)}
          type="url" required placeholder="https://…"
          className={`flex-1 ${inputCls}`} />
        <button type="submit" disabled={loading} className={btnPrimary}>
          {loading ? "Fetching…" : "Fetch"}
        </button>
      </form>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {preview && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 space-y-3 text-sm">
            <div><span className="text-neutral-500">Name: </span><span className="font-medium">{preview.name}</span></div>
            {preview.timeMinutes && <div><span className="text-neutral-500">Time: </span>{preview.timeMinutes} min</div>}
            {preview.servingsDefault && <div><span className="text-neutral-500">Servings: </span>{preview.servingsDefault}</div>}
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
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className={btnPrimary}>
              {saving ? "Saving…" : "Save recipe"}
            </button>
            <button onClick={() => setPreview(null)}
              className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
              Try different URL
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
