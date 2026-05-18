"use client"

import { use, useEffect, useRef, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { findSubRecipe } from "@/lib/subrecipe"

type Ingredient = { name: string; quantity: number | null; unit: string | null }
type Step = { text: string; durationMinutes?: number }

type RecipeStub = { id: string; name: string; timeMinutes: number | null }

type SubRecipeDetail = {
  id: string
  name: string
  ingredients: Ingredient[]
  steps: Step[]
}

type SessionState =
  | { phase: "starting" }
  | { phase: "active"; sessionId: string; startedAt: number; steps: Step[]; ingredients: Ingredient[]; allRecipes: RecipeStub[] }
  | { phase: "finishing" }
  | { phase: "done"; actualMinutes: number }
  | { phase: "error"; message: string }

const inputCls = "w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neutral-500 resize-none"

export default function CookModePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const existingSessionId = searchParams.get("session")

  const [state, setState] = useState<SessionState>({ phase: "starting" })
  const [elapsed, setElapsed] = useState(0)
  const [rating, setRating] = useState<number | null>(null)
  const [notes, setNotes] = useState("")
  const [currentStep, setCurrentStep] = useState(0)
  const [checkedIngs, setCheckedIngs] = useState<Set<number>>(new Set())
  const [showIngs, setShowIngs] = useState(true)
  const [expandedSubRecipe, setExpandedSubRecipe] = useState<SubRecipeDetail | null>(null)
  const [subRecipeStep, setSubRecipeStep] = useState(0)
  const [loadingSubRecipe, setLoadingSubRecipe] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    async function init() {
      try {
        const [recipeRes, allRes] = await Promise.all([
          fetch(`/meals/api/recipes/${id}`),
          fetch("/meals/api/recipes"),
        ])
        const recipeData = await recipeRes.json() as {
          steps: Step[]
          ingredients: Ingredient[]
        }
        const allData = await allRes.json() as { recipes: RecipeStub[] }
        const steps = recipeData.steps ?? []
        const ingredients = recipeData.ingredients ?? []
        const allRecipes = (allData.recipes ?? []).filter((r) => r.id !== id)

        if (existingSessionId) {
          const res = await fetch(`/meals/api/cook-sessions?recipeId=${id}`)
          const data = await res.json() as { session: { id: string; startedAt: string } | null }
          if (data.session) {
            const startedAt = new Date(data.session.startedAt).getTime()
            setState({ phase: "active", sessionId: data.session.id, startedAt, steps, ingredients, allRecipes })
          } else {
            setState({ phase: "error", message: "Session not found. It may have been cancelled." })
          }
          return
        }

        const res = await fetch("/meals/api/cook-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipeId: id }),
        })

        if (res.status === 409) {
          const body = await res.json() as { existingSessionId: string }
          router.replace(`/recipes/${id}/cook?session=${body.existingSessionId}`)
          return
        }
        if (!res.ok) {
          const body = await res.json() as { error: string }
          setState({ phase: "error", message: body.error })
          return
        }

        const data = await res.json() as { sessionId: string; startedAt: string }
        setState({ phase: "active", sessionId: data.sessionId, startedAt: new Date(data.startedAt).getTime(), steps, ingredients, allRecipes })
      } catch (e) {
        setState({ phase: "error", message: String(e) })
      }
    }
    init()
  }, [id, existingSessionId, router])

  useEffect(() => {
    if (state.phase !== "active") return
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - state.startedAt) / 1000))
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [state])

  async function handleFinish() {
    if (state.phase !== "active") return
    setState({ phase: "finishing" })
    const res = await fetch(`/meals/api/cook-sessions/${state.sessionId}/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: rating ?? undefined, notes: notes || undefined }),
    })
    const data = await res.json() as { actualMinutes?: number }
    setState({ phase: "done", actualMinutes: data.actualMinutes ?? Math.round(elapsed / 60) })
  }

  async function handleCancel() {
    if (state.phase !== "active") return
    if (!confirm("Cancel this cook session?")) return
    await fetch(`/meals/api/cook-sessions/${state.sessionId}/cancel`, { method: "POST" })
    router.back()
  }

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`

  if (state.phase === "starting") return <div className="text-sm text-neutral-500">Starting session…</div>
  if (state.phase === "error") return (
    <div className="space-y-4">
      <p className="text-red-500 text-sm">{state.message}</p>
      <button onClick={() => router.back()} className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">← Back</button>
    </div>
  )
  if (state.phase === "done") return (
    <div className="space-y-4 text-center py-8">
      <div className="text-4xl">✓</div>
      <p className="text-lg font-medium">Done! Cooked in {state.actualMinutes} min</p>
      <p className="text-sm text-neutral-500">Pantry auto-deduction in progress.</p>
      <button onClick={() => router.push("/")}
        className="px-6 py-2.5 bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 rounded-lg text-sm font-medium hover:opacity-90">
        Back to suggestions
      </button>
    </div>
  )

  const steps = state.phase === "active" ? state.steps : []
  const ingredients = state.phase === "active" ? state.ingredients : []
  const allRecipes = state.phase === "active" ? state.allRecipes : []

  async function loadSubRecipe(subId: string) {
    setLoadingSubRecipe(true)
    try {
      const res = await fetch(`/meals/api/recipes/${subId}`)
      const data = await res.json() as { name: string; steps: Step[]; ingredients: Ingredient[] }
      setExpandedSubRecipe({ id: subId, name: data.name, steps: data.steps ?? [], ingredients: data.ingredients ?? [] })
      setSubRecipeStep(0)
    } finally { setLoadingSubRecipe(false) }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Cooking</h1>
        <div className="font-mono text-2xl text-neutral-500 dark:text-neutral-300">{fmtTime(elapsed)}</div>
      </div>

      {/* Ingredients checklist */}
      {ingredients.length > 0 && (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <button
            onClick={() => setShowIngs((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium bg-neutral-50 dark:bg-neutral-900/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <span>Ingredients</span>
            <span className="text-xs text-neutral-400">
              {checkedIngs.size}/{ingredients.length} done · {showIngs ? "hide" : "show"}
            </span>
          </button>
          {showIngs && (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {ingredients.map((ing, i) => {
                const subRecipe = findSubRecipe(ing.name, allRecipes)
                const isExpanded = expandedSubRecipe !== null && subRecipe?.id === expandedSubRecipe.id
                return (
                  <li key={i} className="border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                    <div
                      onClick={() => setCheckedIngs((prev) => {
                        const next = new Set(prev)
                        if (next.has(i)) next.delete(i); else next.add(i)
                        return next
                      })}
                      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors select-none"
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors text-xs ${
                        checkedIngs.has(i)
                          ? "bg-neutral-900 dark:bg-neutral-100 border-neutral-900 dark:border-neutral-100 text-white dark:text-neutral-900"
                          : "border-neutral-300 dark:border-neutral-600"
                      }`}>
                        {checkedIngs.has(i) && "✓"}
                      </span>
                      <span className={`text-sm flex-1 ${checkedIngs.has(i) ? "line-through text-neutral-400 dark:text-neutral-600" : ""}`}>
                        {ing.quantity != null && <span className="font-mono mr-1">{ing.quantity}</span>}
                        {ing.unit && <span className="text-neutral-500 mr-1">{ing.unit}</span>}
                        {ing.name}
                      </span>
                      {subRecipe && !checkedIngs.has(i) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (isExpanded) { setExpandedSubRecipe(null) } else { loadSubRecipe(subRecipe.id) }
                          }}
                          className={`text-xs shrink-0 px-2 py-0.5 rounded transition-colors ${
                            isExpanded
                              ? "bg-blue-500 text-white"
                              : "text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950"
                          }`}
                        >
                          {loadingSubRecipe && !isExpanded ? "…" : isExpanded ? "hide" : "make it"}
                        </button>
                      )}
                    </div>

                    {/* Inline sub-recipe */}
                    {isExpanded && expandedSubRecipe && (
                      <div className="mx-4 mb-3 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 overflow-hidden">
                        <div className="px-3 py-2 bg-blue-100 dark:bg-blue-900/40 flex items-center justify-between">
                          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                            {expandedSubRecipe.name}
                          </span>
                          <span className="text-xs text-blue-500">{expandedSubRecipe.steps.length} steps</span>
                        </div>

                        {/* Sub-recipe ingredients */}
                        {expandedSubRecipe.ingredients.length > 0 && (
                          <div className="px-3 py-2 border-b border-blue-200 dark:border-blue-900">
                            <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">You'll need:</p>
                            <ul className="space-y-0.5">
                              {expandedSubRecipe.ingredients.map((si, si_i) => (
                                <li key={si_i} className="text-xs text-blue-700 dark:text-blue-300">
                                  {si.quantity != null && <span className="font-mono mr-1">{si.quantity}</span>}
                                  {si.unit && <span className="opacity-70 mr-1">{si.unit}</span>}
                                  {si.name}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Sub-recipe steps */}
                        {expandedSubRecipe.steps.length > 0 && (
                          <div className="px-3 py-2">
                            <div className="flex items-center justify-between mb-1.5 text-xs text-blue-600 dark:text-blue-400">
                              <span>Step {subRecipeStep + 1} of {expandedSubRecipe.steps.length}</span>
                              <div className="flex gap-2">
                                {subRecipeStep > 0 && (
                                  <button onClick={() => setSubRecipeStep((s) => s - 1)} className="hover:text-blue-800 dark:hover:text-blue-200">← Prev</button>
                                )}
                                {subRecipeStep < expandedSubRecipe.steps.length - 1 && (
                                  <button onClick={() => setSubRecipeStep((s) => s + 1)} className="hover:text-blue-800 dark:hover:text-blue-200">Next →</button>
                                )}
                                {subRecipeStep === expandedSubRecipe.steps.length - 1 && (
                                  <button
                                    onClick={() => {
                                      setExpandedSubRecipe(null)
                                      setCheckedIngs((prev) => { const next = new Set(prev); next.add(i); return next })
                                    }}
                                    className="text-green-600 dark:text-green-400 font-medium hover:text-green-700"
                                  >
                                    Done ✓
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                              {expandedSubRecipe.steps[subRecipeStep].text}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {/* Steps */}
      {steps.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2 text-xs text-neutral-500">
            <span>Step {currentStep + 1} of {steps.length}</span>
            <div className="flex gap-3">
              {currentStep > 0 && (
                <button onClick={() => setCurrentStep((s) => s - 1)} className="hover:text-neutral-900 dark:hover:text-neutral-100">← Prev</button>
              )}
              {currentStep < steps.length - 1 && (
                <button onClick={() => setCurrentStep((s) => s + 1)} className="hover:text-neutral-900 dark:hover:text-neutral-100">Next →</button>
              )}
            </div>
          </div>
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm leading-relaxed">
            {steps[currentStep].durationMinutes && (
              <span className="text-xs text-neutral-500 block mb-2">{steps[currentStep].durationMinutes} min</span>
            )}
            {steps[currentStep].text}
          </div>
          <div className="flex gap-1 mt-2 justify-center">
            {steps.map((_, i) => (
              <button key={i} onClick={() => setCurrentStep(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === currentStep
                    ? "bg-neutral-900 dark:bg-neutral-100"
                    : "bg-neutral-300 dark:bg-neutral-700"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Finish / rating */}
      {(state.phase === "active" || state.phase === "finishing") && (
        <div className="space-y-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex gap-3 items-center">
            <span className="text-sm text-neutral-500">Rating:</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(rating === n ? null : n)}
                className={`text-lg transition-colors ${n <= (rating ?? 0) ? "text-yellow-500" : "text-neutral-300 dark:text-neutral-700 hover:text-neutral-400"}`}>
                ★
              </button>
            ))}
          </div>
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)" rows={2}
            className={inputCls}
          />
          <div className="flex gap-3">
            {(() => {
              const isFinishing = state.phase === "finishing"
              return (
                <>
                  <button onClick={handleFinish} disabled={isFinishing}
                    className="px-6 py-2.5 bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40">
                    {isFinishing ? "Saving…" : "Finish cooking"}
                  </button>
                  <button onClick={handleCancel} disabled={isFinishing}
                    className="px-4 py-2.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 disabled:opacity-40">
                    Cancel
                  </button>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
