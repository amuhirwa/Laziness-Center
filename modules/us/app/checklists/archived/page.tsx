export const dynamic = "force-dynamic"

import { db } from "@/db"
import { checklists } from "@/db/schema"
import { eq } from "drizzle-orm"
import Link from "next/link"

export default async function ArchivedPage() {
  const rows = await db.select().from(checklists)
    .where(eq(checklists.isArchived, true))
    .orderBy()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/us/checklists" className="text-sm text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300">← Back</Link>
        <h1 className="font-semibold">Archived</h1>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-400">Nothing archived yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((cl) => (
            <Link key={cl.id} href={`/us/checklists/${cl.id}`}
              className="block p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
              <p className="font-medium text-sm">{cl.name}</p>
              {cl.archivedAt && (
                <p className="text-xs text-neutral-400 mt-1">Archived {cl.archivedAt.toLocaleDateString()}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
