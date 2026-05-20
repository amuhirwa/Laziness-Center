export const dynamic = "force-dynamic"

import { db } from "@/db"
import { checklists, checklistItems } from "@/db/schema"
import { and, count, eq } from "drizzle-orm"
import Link from "next/link"
import NewChecklistForm from "./new-form"

export default async function ChecklistsPage() {
  const rows = await db.select().from(checklists)
    .where(eq(checklists.isArchived, false))
    .orderBy()

  // Count total / done items per checklist
  const totals = await db.select({
    checklistId: checklistItems.checklistId,
    total: count(),
  }).from(checklistItems)
    .where(eq(checklistItems.completed, false))
    .groupBy(checklistItems.checklistId)

  const totalMap = new Map(totals.map((r) => [r.checklistId, r.total]))

  const pinned = rows.filter((r) => r.isPinned)
  const rest = rows.filter((r) => !r.isPinned)

  const Card = ({ cl }: { cl: typeof rows[0] }) => {
    const remaining = totalMap.get(cl.id) ?? 0
    return (
      <Link
        href={`/us/checklists/${cl.id}`}
        className="block p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-sm">{cl.name}</p>
            {cl.description && <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1">{cl.description}</p>}
          </div>
          {cl.isPinned && <span className="text-yellow-500 text-xs shrink-0">★</span>}
        </div>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">
          {remaining === 0 ? "All done" : `${remaining} left`}
        </p>
      </Link>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold">Checklists</h1>
        <Link href="/us/checklists/archived" className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300">
          Archived
        </Link>
      </div>

      <NewChecklistForm />

      {pinned.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Pinned</p>
          {pinned.map((cl) => <Card key={cl.id} cl={cl} />)}
        </div>
      )}

      {rest.length > 0 ? (
        <div className="space-y-2">
          {pinned.length > 0 && <p className="text-xs uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Active</p>}
          {rest.map((cl) => <Card key={cl.id} cl={cl} />)}
        </div>
      ) : pinned.length === 0 && (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">No checklists yet. Create one above.</p>
      )}
    </div>
  )
}
