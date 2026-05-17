"use client"

import { use, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

type SessionState =
  | { phase: "starting" }
  | { phase: "active"; sessionId: string; startedAt: number; steps: Array<{ text: string; durationMinutes?: number }> }
  | { phase: "finishing" }
  | { phase: "done"; actualMinutes: number }
  | { phase: "error"; message: string }

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
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    async function init() {
      try {
        if (existingSessionId) {
          // Resumed session — fetch recipe steps via existing session check
          const res = await fetch(`/meals/api/cook-sessions?recipeId=${id}`)
          const data = await res.json() as { session: { id: string; startedAt: string; servings: number } | null }
          if (data.session) {
            const stepsRes = await fetch(`/meals/api/recipes/${id}`)
            const recipeData = await stepsRes.json() as { steps: Array<{ text: string; durationMinutes?: number }> }
            const startedAt = new Date(data.session.startedAt).getTime()
            setState({ phase: "active", sessionId: data.session.id, startedAt, steps: recipeData.steps ?? [] })
          } else {
            setState({ phase: "error", message: "Session not found. It may have been cancelled." })
          }
          return
        }

        // Start new session
        const res = await fetch("/meals/api/cook-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipeId: id }),
        })

        if (res.status === 409) {
          const body = await res.json() as { existingSessionId: string }
          router.replace(`/meals/recipes/${id}/cook?session=${body.existingSessionId}`)
          return
        }

        if (!res.ok) {
          const body = await res.json() as { error: string }
          setState({ phase: "error", message: body.error })
          return
        }

        const data = await res.json() as {
          sessionId: string; startedAt: string
          recipe: { steps: Array<{ text: string; durationMinutes?: number }> }
        }
        setState({
          phase: "active",
          sessionId: data.sessionId,
          startedAt: new Date(data.startedAt).getTime(),
          steps: data.recipe.steps,
        })
      } catch (e) {
        setState({ phase: "error", message: String(e) })
      }
    }

    init()
  }, [id, existingSessionId, router])

  // Elapsed timer
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
      <p className="text-red-400 text-sm">{state.message}</p>
      <button onClick={() => router.back()} className="text-sm text-neutral-400 hover:text-neutral-100">← Back</button>
    </div>
  )
  if (state.phase === "done") return (
    <div className="space-y-4 text-center py-8">
      <div className="text-4xl">✓</div>
      <p className="text-lg font-medium">Done! Cooked in {state.actualMinutes} min</p>
      <p className="text-sm text-neutral-500">Pantry auto-deduction in progress.</p>
      <button onClick={() => router.push("/meals")}
        className="px-6 py-2.5 bg-neutral-100 text-neutral-900 rounded-lg text-sm font-medium hover:bg-white">
        Back to suggestions
      </button>
    </div>
  )

  const steps = state.phase === "active" ? state.steps : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Cooking</h1>
        <div className="font-mono text-2xl text-neutral-300">{fmtTime(elapsed)}</div>
      </div>

      {steps.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2 text-xs text-neutral-500">
            <span>Step {currentStep + 1} of {steps.length}</span>
            <div className="flex gap-2">
              {currentStep > 0 && (
                <button onClick={() => setCurrentStep((s) => s - 1)} className="hover:text-neutral-100">← Prev</button>
              )}
              {currentStep < steps.length - 1 && (
                <button onClick={() => setCurrentStep((s) => s + 1)} className="hover:text-neutral-100">Next →</button>
              )}
            </div>
          </div>
          <div className="p-4 rounded-xl border border-neutral-700 bg-neutral-900 text-sm leading-relaxed">
            {steps[currentStep].durationMinutes && (
              <span className="text-xs text-neutral-600 block mb-2">{steps[currentStep].durationMinutes} min</span>
            )}
            {steps[currentStep].text}
          </div>
          <div className="flex gap-1 mt-2 justify-center">
            {steps.map((_, i) => (
              <button key={i} onClick={() => setCurrentStep(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === currentStep ? "bg-neutral-100" : "bg-neutral-700"}`}
              />
            ))}
          </div>
        </div>
      )}

      {state.phase === "active" && (
        <div className="space-y-4 pt-4 border-t border-neutral-800">
          <div className="flex gap-3 items-center">
            <span className="text-sm text-neutral-400">Rating:</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(rating === n ? null : n)}
                className={`text-lg transition-colors ${n <= (rating ?? 0) ? "text-yellow-400" : "text-neutral-700 hover:text-neutral-500"}`}>
                ★
              </button>
            ))}
          </div>
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neutral-500 resize-none"
          />
          <div className="flex gap-3">
            <button onClick={handleFinish} disabled={state.phase === "finishing"}
              className="px-6 py-2.5 bg-neutral-100 text-neutral-900 rounded-lg text-sm font-medium hover:bg-white disabled:opacity-40">
              {state.phase === "finishing" ? "Saving…" : "Finish cooking"}
            </button>
            <button onClick={handleCancel}
              className="px-4 py-2.5 text-sm text-neutral-500 hover:text-neutral-100">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
