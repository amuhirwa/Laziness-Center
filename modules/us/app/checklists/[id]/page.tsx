export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { db } from "@/db"
import { checklists, checklistItems, comments } from "@/db/schema"
import { asc, eq } from "drizzle-orm"
import Link from "next/link"
import { notFound } from "next/navigation"
import ChecklistDetail from "./checklist-detail"

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const [checklist] = await db.select({ name: checklists.name }).from(checklists).where(eq(checklists.id, id))
  return { title: checklist ? `${checklist.name} — Laziness Center` : "Us — Laziness Center" }
}

export default async function ChecklistPage({ params }: Props) {
  const { id } = await params
  const [checklist] = await db.select().from(checklists).where(eq(checklists.id, id))
  if (!checklist) notFound()

  const items = await db.select().from(checklistItems)
    .where(eq(checklistItems.checklistId, id))
    .orderBy(asc(checklistItems.position), asc(checklistItems.createdAt))

  const commentRows = await db.select().from(comments)
    .where(eq(comments.itemId, id))
    .orderBy(asc(comments.createdAt))

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Link href="/checklists" className="text-sm text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 shrink-0 pt-0.5">←</Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-lg leading-tight">{checklist.name}</h1>
          {checklist.description && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{checklist.description}</p>
          )}
        </div>
      </div>

      <ChecklistDetail checklist={checklist} initialItems={items} initialComments={commentRows} />
    </div>
  )
}
