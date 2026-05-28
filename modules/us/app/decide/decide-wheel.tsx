"use client"

import { useState, useRef, useEffect } from "react"
import type { Candidate } from "./page"

type Phase = "pick" | "vote1" | "vote2" | "spinning" | "result"
type Scores = Record<string, number>

const WHEEL_COLORS = [
  "#f87171", "#fb923c", "#fbbf24", "#4ade80", "#60a5fa", "#a78bfa",
]

const SECTION_LABELS: Record<string, string> = {
  place: "📍 Places", wishlist: "🛍 Wishlist", activity: "✨ Activities",
}

function weightedRandom(candidates: Candidate[], scores: Scores): Candidate {
  const total = candidates.reduce((s, c) => s + (scores[c.id] ?? 1), 0)
  let r = Math.random() * total
  for (const c of candidates) {
    r -= (scores[c.id] ?? 1)
    if (r <= 0) return c
  }
  return candidates[candidates.length - 1]
}

function buildGradient(candidates: Candidate[], scores: Scores): string {
  const total = candidates.reduce((s, c) => s + (scores[c.id] ?? 1), 0)
  const segments: string[] = []
  let cum = 0
  candidates.forEach((c, i) => {
    const pct = (scores[c.id] ?? 1) / total
    const start = Math.round(cum * 360)
    cum += pct
    const end = Math.round(cum * 360)
    segments.push(`${WHEEL_COLORS[i % WHEEL_COLORS.length]} ${start}deg ${end}deg`)
  })
  return `conic-gradient(${segments.join(", ")})`
}

function winnerAngle(candidates: Candidate[], scores: Scores, winner: Candidate): number {
  const total = candidates.reduce((s, c) => s + (scores[c.id] ?? 1), 0)
  let cum = 0
  for (const c of candidates) {
    const pct = (scores[c.id] ?? 1) / total
    const start = cum
    cum += pct
    if (c.id === winner.id) {
      const mid = (start + cum) / 2
      return mid * 360
    }
  }
  return 0
}

export default function DecideWheel({
  placeCandidates, wishlistCandidates, activityCandidates,
}: {
  placeCandidates: Candidate[]
  wishlistCandidates: Candidate[]
  activityCandidates: Candidate[]
}) {
  const all = { place: placeCandidates, wishlist: wishlistCandidates, activity: activityCandidates }

  const [phase, setPhase] = useState<Phase>("pick")
  const [selected, setSelected] = useState<Candidate[]>([])
  const [mode, setMode] = useState<"quick" | "weighted">("quick")
  const [scores1, setScores1] = useState<Scores>({})
  const [scores2, setScores2] = useState<Scores>({})
  const [winner, setWinner] = useState<Candidate | null>(null)
  const [combinedScores, setCombinedScores] = useState<Scores>({})
  const [spinDeg, setSpinDeg] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [expandSection, setExpandSection] = useState<Record<string, boolean>>({ place: true, wishlist: true, activity: true })
  const wheelRef = useRef<HTMLDivElement>(null)

  function toggleCandidate(c: Candidate) {
    setSelected((prev) => {
      const has = prev.some((x) => x.id === c.id)
      if (has) return prev.filter((x) => x.id !== c.id)
      if (prev.length >= 6) return prev
      return [...prev, c]
    })
  }

  function initScores(): Scores {
    const equal = Math.floor(100 / selected.length)
    const rem = 100 - equal * selected.length
    const s: Scores = {}
    selected.forEach((c, i) => { s[c.id] = equal + (i === 0 ? rem : 0) })
    return s
  }

  function sumScores(scores: Scores) {
    return Object.values(scores).reduce((a, b) => a + b, 0)
  }

  function updateScore(scores: Scores, id: string, val: number, setter: (s: Scores) => void) {
    const clamped = Math.max(0, Math.min(100, val))
    setter({ ...scores, [id]: clamped })
  }

  function startVoting() {
    if (selected.length < 2) return
    if (mode === "quick") {
      doSpin({ quick: true })
    } else {
      setScores1(initScores())
      setPhase("vote1")
    }
  }

  function lockIn1() {
    if (sumScores(scores1) !== 100) return
    setScores2(initScores())
    setPhase("vote2")
  }

  function lockIn2() {
    if (sumScores(scores2) !== 100) return
    const combined: Scores = {}
    selected.forEach((c) => {
      combined[c.id] = ((scores1[c.id] ?? 0) + (scores2[c.id] ?? 0)) / 2
    })
    setCombinedScores(combined)
    doSpin({ quick: false, scores: combined })
  }

  function doSpin({ quick, scores }: { quick: boolean; scores?: Scores }) {
    const finalScores = quick ? Object.fromEntries(selected.map((c) => [c.id, 1])) : (scores ?? {})
    const picked = weightedRandom(selected, finalScores)
    setCombinedScores(finalScores)
    setWinner(picked)
    setPhase("spinning")

    const targetAngle = winnerAngle(selected, finalScores, picked)
    const extraSpins = 5 * 360
    // The wheel rotates clockwise, pointer is at top (0deg = top)
    // We want the winning segment's midpoint to end up at 0deg (top of pointer)
    // So we subtract targetAngle from 360 to get the correct offset
    const offsetAngle = (360 - targetAngle + Math.random() * 10 - 5) % 360
    const totalDeg = spinDeg + extraSpins + offsetAngle
    setSpinDeg(totalDeg)
  }

  function onSpinEnd() {
    if (phase === "spinning") setPhase("result")
  }

  async function saveDecision() {
    if (!winner) return
    setSaving(true)
    await fetch("/us/api/decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        winnerTitle: winner.title,
        winnerType: winner.type,
        winnerId: winner.id,
        candidates: selected.map((c) => ({
          type: c.type, id: c.id, title: c.title,
          user1Score: scores1[c.id] ?? null,
          user2Score: scores2[c.id] ?? null,
          combinedScore: combinedScores[c.id] ?? 1,
        })),
        votes: mode === "weighted"
          ? { user1: scores1, user2: scores2 }
          : undefined,
      }),
    })
    setSaving(false)
    setSaved(true)
  }

  function reset() {
    setPhase("pick")
    setSelected([])
    setScores1({})
    setScores2({})
    setWinner(null)
    setCombinedScores({})
    setSaved(false)
    setSaving(false)
  }

  const gradient = selected.length >= 2 ? buildGradient(selected, combinedScores.hasOwnProperty(selected[0]?.id) ? combinedScores : Object.fromEntries(selected.map((c) => [c.id, 1]))) : ""

  const ScoreSliders = ({ scores, setScores }: { scores: Scores; setScores: (s: Scores) => void }) => {
    const total = sumScores(scores)
    return (
      <div className="space-y-3">
        <p className="text-xs text-neutral-400 text-right">Total: <span className={total === 100 ? "text-green-500 font-medium" : "text-red-500 font-medium"}>{total}/100</span></p>
        {selected.map((c, i) => (
          <div key={c.id} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: WHEEL_COLORS[i % WHEEL_COLORS.length] }} />
                <span className="text-sm font-medium">{c.title}</span>
              </div>
              <span className="text-sm font-bold tabular-nums">{scores[c.id] ?? 0}</span>
            </div>
            <input type="range" min={0} max={100} value={scores[c.id] ?? 0}
              onChange={(e) => updateScore(scores, c.id, parseInt(e.target.value), setScores)}
              className="w-full accent-neutral-900 dark:accent-neutral-100" />
          </div>
        ))}
      </div>
    )
  }

  // PICK phase
  if (phase === "pick") {
    const hasEnough = selected.length >= 2
    return (
      <div className="space-y-5">
        {/* Mode toggle */}
        <div className="flex gap-2 text-sm">
          <button onClick={() => setMode("quick")}
            className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${mode === "quick" ? "border-neutral-900 dark:border-neutral-100 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900" : "border-neutral-200 dark:border-neutral-700 text-neutral-500"}`}>
            🎡 Quick spin
          </button>
          <button onClick={() => setMode("weighted")}
            className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${mode === "weighted" ? "border-neutral-900 dark:border-neutral-100 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900" : "border-neutral-200 dark:border-neutral-700 text-neutral-500"}`}>
            🗳 Weighted vote
          </button>
        </div>

        {/* Candidate pools */}
        {(Object.entries(all) as [string, Candidate[]][]).map(([type, pool]) => {
          if (pool.length === 0) return null
          const open = expandSection[type] !== false
          return (
            <div key={type} className="space-y-2">
              <button onClick={() => setExpandSection((s) => ({ ...s, [type]: !open }))}
                className="flex items-center justify-between w-full text-xs uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                <span>{SECTION_LABELS[type]} ({pool.length})</span>
                <span>{open ? "▾" : "▸"}</span>
              </button>
              {open && (
                <div className="space-y-1">
                  {pool.map((c) => {
                    const isSelected = selected.some((x) => x.id === c.id)
                    const selIdx = selected.findIndex((x) => x.id === c.id)
                    return (
                      <button key={c.id} onClick={() => toggleCandidate(c)}
                        disabled={!isSelected && selected.length >= 6}
                        className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors disabled:opacity-40 ${
                          isSelected
                            ? "border-neutral-900 dark:border-neutral-100 bg-neutral-50 dark:bg-neutral-800"
                            : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
                        }`}>
                        <span className="text-base shrink-0">{c.emoji ?? "•"}</span>
                        <span className="text-sm flex-1">{c.title}</span>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-xs text-white font-bold"
                            style={{ background: WHEEL_COLORS[selIdx % WHEEL_COLORS.length] }}>
                            {selIdx + 1}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {selected.length > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <p className="text-sm text-neutral-500">{selected.length} selected {selected.length < 2 ? "(need at least 2)" : ""}</p>
            <button onClick={startVoting} disabled={!hasEnough}
              className="px-5 py-2 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity">
              {mode === "quick" ? "Spin! 🎡" : "Start voting →"}
            </button>
          </div>
        )}

        {Object.values(all).every((p) => p.length === 0) && (
          <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-8">
            Add some places, wishlist items, or activities first — then come here to decide!
          </p>
        )}
      </div>
    )
  }

  // VOTE phases
  if (phase === "vote1" || phase === "vote2") {
    const isV1 = phase === "vote1"
    const scores = isV1 ? scores1 : scores2
    const setScores = isV1 ? setScores1 : setScores2
    const total = sumScores(scores)

    return (
      <div className="space-y-5">
        <div className="text-center space-y-1">
          <p className="text-sm font-medium">{isV1 ? "Person 1 — set your scores" : "Person 2 — your turn"}</p>
          <p className="text-xs text-neutral-400">{isV1 ? "Lock in and pass the phone to your partner." : "Lock in to spin the wheel!"}</p>
        </div>

        <ScoreSliders scores={scores} setScores={setScores} />

        <button onClick={isV1 ? lockIn1 : lockIn2} disabled={total !== 100}
          className="w-full py-2.5 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity">
          {isV1 ? "Lock in → Pass to partner" : "Lock in → Spin! 🎡"}
        </button>

        <button onClick={reset} className="w-full text-xs text-neutral-400 hover:text-neutral-600">← Back to pick</button>
      </div>
    )
  }

  // SPINNING + RESULT phases
  const resultWinner = winner
  const href = resultWinner?.type === "place" ? `/places/${resultWinner.id}`
    : resultWinner?.type === "wishlist" ? `/wishlists/${resultWinner.id}`
    : resultWinner?.type === "activity" ? `/activities/${resultWinner.id}`
    : null

  return (
    <div className="space-y-6 flex flex-col items-center">
      {/* Wheel */}
      <div className="relative" style={{ width: 280, height: 280 }}>
        {/* Pointer */}
        <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 z-10 w-0 h-0"
          style={{ borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "20px solid #111" }} />
        <div
          ref={wheelRef}
          style={{
            width: 280, height: 280,
            borderRadius: "50%",
            background: gradient,
            transform: `rotate(${spinDeg}deg)`,
            transition: phase === "spinning" ? "transform 5s cubic-bezier(0.23, 0.88, 0.32, 1.0)" : "none",
            boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
          }}
          onTransitionEnd={onSpinEnd}
        />
        {/* Center circle */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-white dark:bg-neutral-900 shadow-md flex items-center justify-center text-lg">
            {phase === "spinning" ? "🎡" : "✨"}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1 w-full max-w-xs">
        {selected.map((c, i) => (
          <div key={c.id} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: WHEEL_COLORS[i % WHEEL_COLORS.length] }} />
            <span className="truncate">{c.title}</span>
            {mode === "weighted" && combinedScores[c.id] != null && (
              <span className="ml-auto text-xs text-neutral-400">{Math.round(combinedScores[c.id])}%</span>
            )}
          </div>
        ))}
      </div>

      {/* Result */}
      {phase === "result" && resultWinner && (
        <div className="w-full text-center space-y-3">
          <div className="p-4 rounded-2xl border-2 border-neutral-900 dark:border-neutral-100 bg-neutral-50 dark:bg-neutral-900">
            <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Winner</p>
            <p className="text-xl font-bold">{resultWinner.emoji} {resultWinner.title}</p>
            {href && (
              <a href={`/us${href}`}
                className="inline-block mt-2 text-xs text-blue-500 hover:underline">
                View details →
              </a>
            )}
          </div>

          <div className="flex gap-2">
            {!saved ? (
              <button onClick={saveDecision} disabled={saving}
                className="flex-1 py-2 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity">
                {saving ? "Saving…" : "Save decision"}
              </button>
            ) : (
              <div className="flex-1 py-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm text-center font-medium">
                ✓ Saved!
              </div>
            )}
            <button onClick={reset}
              className="flex-1 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
              Try again
            </button>
          </div>
        </div>
      )}

      {phase === "spinning" && (
        <p className="text-sm text-neutral-400 animate-pulse">Spinning…</p>
      )}
    </div>
  )
}
