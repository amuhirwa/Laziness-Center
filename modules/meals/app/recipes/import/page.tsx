"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import type { ImportedRecipe } from "@/lib/import"
import {
  searchMealDB, getRandomMeal, mealDBToRecipe,
  getCategories, getMealsByCategory, getMealById,
  type MealDBMeal, type MealDBCategory, type MealDBSummary,
} from "@/lib/mealdb"

const inputCls = "bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neutral-500"
const btnPrimary = "px-4 py-2 bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"
const btnSecondary = "px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"

export default function ImportPage() {
  const router = useRouter()
  const [tab, setTab] = useState<"url" | "mealdb" | "category" | "json">("mealdb")

  return (
    <div className="max-w-lg">
      <h1 className="text-lg font-semibold mb-4">Import Recipe</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-neutral-200 dark:border-neutral-800">
        {([["mealdb", "Search MealDB"], ["category", "By Category"], ["url", "From URL"], ["json", "Paste JSON"]] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t
                ? "border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100"
                : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "mealdb" && <MealDBTab router={router} />}
      {tab === "category" && <CategoryTab router={router} />}
      {tab === "url" && <UrlTab router={router} />}
      {tab === "json" && <JsonTab router={router} />}
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

// ── Category tab ──────────────────────────────────────────────────────────

function CategoryTab({ router }: { router: ReturnType<typeof useRouter> }) {
  const [view, setView] = useState<"categories" | "meals" | "importing">("categories")
  const [categories, setCategories] = useState<MealDBCategory[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [meals, setMeals] = useState<MealDBSummary[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState("")
  const [importedCount, setImportedCount] = useState(0)

  useEffect(() => {
    setLoading(true)
    getCategories()
      .then(setCategories)
      .catch(() => setError("Failed to load categories"))
      .finally(() => setLoading(false))
  }, [])

  async function handleSelectCategory(cat: string) {
    setActiveCategory(cat)
    setView("meals")
    setSelected(new Set())
    setLoading(true)
    setError("")
    try {
      const results = await getMealsByCategory(cat)
      setMeals(results)
    } catch { setError("Failed to load meals") }
    finally { setLoading(false) }
  }

  function toggleMeal(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === meals.length ? new Set() : new Set(meals.map((m) => m.idMeal))
    )
  }

  async function handleImport() {
    if (selected.size === 0) return
    setView("importing")
    const ids = [...selected]
    setProgress({ done: 0, total: ids.length })
    let imported = 0
    let lastId: string | null = null

    for (let i = 0; i < ids.length; i++) {
      try {
        const meal = await getMealById(ids[i])
        if (meal) {
          const recipe = mealDBToRecipe(meal)
          const res = await fetch("/meals/api/recipes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(recipe),
          })
          if (res.ok) { imported++; lastId = (await res.json() as { recipeId: string }).recipeId }
        }
      } catch { /* skip failed individual import */ }
      setProgress({ done: i + 1, total: ids.length })
      // Polite delay to avoid hammering TheMealDB
      if (i < ids.length - 1) await new Promise((r) => setTimeout(r, 150))
    }

    setImportedCount(imported)
    if (imported === 1 && lastId) {
      router.push(`/recipes/${lastId}`)
    }
  }

  if (view === "importing") {
    const done = progress?.done ?? 0
    const total = progress?.total ?? 1
    const finished = done === total
    return (
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{finished ? "Done!" : `Importing ${done} of ${total}…`}</span>
            <span className="text-neutral-500">{done}/{total}</span>
          </div>
          <div className="h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-neutral-900 dark:bg-neutral-100 rounded-full transition-all duration-300"
              style={{ width: `${(done / total) * 100}%` }}
            />
          </div>
        </div>
        {finished && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {importedCount} recipe{importedCount !== 1 ? "s" : ""} imported from <strong>{activeCategory}</strong>.
            </p>
            <div className="flex gap-3">
              <button onClick={() => router.push("/recipes")}
                className={btnPrimary}>View library</button>
              <button onClick={() => { setView("categories"); setSelected(new Set()) }}
                className={btnSecondary}>Import more</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (view === "meals") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setView("categories")}
            className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
            ← {activeCategory}
          </button>
          <span className="text-xs text-neutral-500">{meals.length} meals</span>
        </div>

        {loading && <p className="text-sm text-neutral-500">Loading…</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}

        {meals.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox"
                  checked={selected.size === meals.length}
                  onChange={toggleAll}
                  className="accent-neutral-600 dark:accent-neutral-400" />
                Select all ({meals.length})
              </label>
              {selected.size > 0 && (
                <span className="text-xs text-neutral-500">{selected.size} selected</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
              {meals.map((meal) => (
                <label key={meal.idMeal}
                  className={`relative rounded-xl border overflow-hidden cursor-pointer transition-colors ${
                    selected.has(meal.idMeal)
                      ? "border-neutral-900 dark:border-neutral-100"
                      : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600"
                  }`}>
                  <input type="checkbox" className="sr-only"
                    checked={selected.has(meal.idMeal)}
                    onChange={() => toggleMeal(meal.idMeal)} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${meal.strMealThumb}/preview`} alt={meal.strMeal}
                    className="w-full h-24 object-cover" />
                  {selected.has(meal.idMeal) && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-neutral-900 dark:bg-neutral-100 rounded-full flex items-center justify-center text-xs text-white dark:text-neutral-900 font-bold">✓</div>
                  )}
                  <div className="p-2">
                    <p className="text-xs font-medium leading-snug line-clamp-2">{meal.strMeal}</p>
                  </div>
                </label>
              ))}
            </div>

            <button
              onClick={handleImport}
              disabled={selected.size === 0}
              className={btnPrimary}>
              Import {selected.size > 0 ? `${selected.size} ` : ""}recipe{selected.size !== 1 ? "s" : ""}
            </button>
          </>
        )}
      </div>
    )
  }

  // Category grid
  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">Pick a category to browse and bulk-import recipes.</p>
      {loading && <p className="text-sm text-neutral-500">Loading categories…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        {categories.map((cat) => (
          <button key={cat.idCategory} onClick={() => handleSelectCategory(cat.strCategory)}
            className="text-left rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cat.strCategoryThumb} alt={cat.strCategory}
              className="w-full h-24 object-cover" />
            <div className="p-2.5">
              <p className="text-sm font-medium">{cat.strCategory}</p>
            </div>
          </button>
        ))}
      </div>
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

// ── JSON tab ───────────────────────────────────────────────────────────────

const JSON_TEMPLATE = {
  name: "Recipe Name",
  timeMinutes: 30,
  servingsDefault: 2,
  difficulty: "easy",
  mealTypes: ["dinner"],
  tags: ["tag1", "tag2"],
  ingredients: [
    { name: "flour", quantity: 200, unit: "g" },
    { name: "eggs", quantity: 2, unit: "pcs" },
    { name: "butter", quantity: 50, unit: "g" },
  ],
  steps: [
    { text: "Mix dry ingredients together.", durationMinutes: 5 },
    { text: "Add wet ingredients and combine." },
    { text: "Cook until done." },
  ],
  sourceUrl: "https://...",
  thumbnailUrl: "https://...",
}

function JsonTab({ router }: { router: ReturnType<typeof useRouter> }) {
  const [raw, setRaw] = useState("")
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<typeof JSON_TEMPLATE | null>(null)
  const [saving, setSaving] = useState(false)

  function handleParse() {
    setError(""); setPreview(null)
    if (!raw.trim()) { setError("Paste your JSON first"); return }
    try {
      const parsed = JSON.parse(raw)
      if (!parsed.name?.trim()) { setError("name is required"); return }
      if (!Array.isArray(parsed.ingredients)) { setError("ingredients must be an array"); return }
      if (!Array.isArray(parsed.steps)) { setError("steps must be an array"); return }
      setPreview(parsed)
    } catch (e) {
      setError(`Invalid JSON: ${String(e).replace("SyntaxError: ", "")}`)
    }
  }

  async function handleSave() {
    if (!preview) return
    setSaving(true)
    try {
      const res = await fetch("/meals/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preview),
      })
      if (!res.ok) { const b = await res.json(); setError(b.error ?? "Failed"); return }
      const data = await res.json() as { recipeId: string }
      router.push(`/recipes/${data.recipeId}`)
    } catch (e) { setError(String(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500">Paste a recipe in JSON format.</p>
        <button
          onClick={() => setRaw(JSON.stringify(JSON_TEMPLATE, null, 2))}
          className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 underline"
        >
          Load template
        </button>
      </div>

      <textarea
        value={raw}
        onChange={(e) => { setRaw(e.target.value); setPreview(null); setError("") }}
        rows={14}
        placeholder={JSON.stringify(JSON_TEMPLATE, null, 2)}
        spellCheck={false}
        className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-neutral-500 resize-none"
      />

      {error && <p className="text-sm text-red-500">{error}</p>}

      {!preview ? (
        <button onClick={handleParse} disabled={!raw.trim()} className={btnPrimary}>
          Preview
        </button>
      ) : (
        <div className="space-y-3">
          <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 text-sm space-y-1">
            <p className="font-medium">{preview.name}</p>
            <p className="text-neutral-500 text-xs">
              {[
                preview.timeMinutes && `${preview.timeMinutes} min`,
                preview.servingsDefault && `${preview.servingsDefault} servings`,
                Array.isArray(preview.ingredients) && `${preview.ingredients.length} ingredients`,
                Array.isArray(preview.steps) && `${preview.steps.length} steps`,
              ].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className={btnPrimary}>
              {saving ? "Saving…" : "Save recipe"}
            </button>
            <button onClick={() => setPreview(null)}
              className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
              Edit JSON
            </button>
          </div>
        </div>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer text-neutral-400 dark:text-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-400">
          Field reference
        </summary>
        <div className="mt-2 space-y-1 text-neutral-500 border border-neutral-200 dark:border-neutral-800 rounded-lg p-3">
          <p><code className="text-neutral-700 dark:text-neutral-300">name</code> string — required</p>
          <p><code className="text-neutral-700 dark:text-neutral-300">timeMinutes</code> number — optional</p>
          <p><code className="text-neutral-700 dark:text-neutral-300">servingsDefault</code> number — default 2</p>
          <p><code className="text-neutral-700 dark:text-neutral-300">difficulty</code> "easy" | "medium" | "hard" — optional</p>
          <p><code className="text-neutral-700 dark:text-neutral-300">mealTypes</code> string[] — "breakfast" | "lunch" | "dinner"</p>
          <p><code className="text-neutral-700 dark:text-neutral-300">tags</code> string[] — any labels, e.g. ["italian", "vegetarian"]</p>
          <p><code className="text-neutral-700 dark:text-neutral-300">ingredients</code> {"{"} name, quantity?, unit? {"}"}[] — required</p>
          <p><code className="text-neutral-700 dark:text-neutral-300">steps</code> {"{"} text, durationMinutes? {"}"}[] — required</p>
          <p><code className="text-neutral-700 dark:text-neutral-300">sourceUrl</code> string — optional</p>
          <p><code className="text-neutral-700 dark:text-neutral-300">thumbnailUrl</code> string — optional</p>
        </div>
      </details>
    </div>
  )
}
