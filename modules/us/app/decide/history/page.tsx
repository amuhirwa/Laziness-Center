export const dynamic = "force-dynamic"

import { db } from "@/db"
import { decisionHistory } from "@/db/schema"
import { desc } from "drizzle-orm"
import Link from "next/link"

type Candidate = { type: string; title: string; combinedScore: number }

export default async function DecisionHistoryPage() {
  const rows = await db.select().from(decisionHistory)
    .orderBy(desc(decisionHistory.decidedAt))

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/decide" className="text-sm text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300">← Decide</Link>
        <h1 className="font-semibold">Decision history</h1>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">No decisions saved yet. Spin the wheel!</p>
      ) : (
        <div className="space-y-3">
          {rows.map((d) => {
            const candidates = (d.candidates as Candidate[]) ?? []
            return (
              <div key={d.id} className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{d.winnerTitle}</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                      {new Date(d.decidedAt).toLocaleDateString("en", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 capitalize shrink-0">{d.mode}</span>
                </div>

                {candidates.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {candidates.map((c, i) => (
                      <span key={i}
                        className={`text-xs px-2 py-0.5 rounded-full ${c.title === d.winnerTitle ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"}`}>
                        {c.title}
                        {d.mode === "weighted" && c.combinedScore != null && (
                          <span className="opacity-60 ml-1">{Math.round(c.combinedScore)}%</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
