export const dynamic = "force-dynamic"

import { db } from "@/db"
import { datePlans, places, checklists, checklistItems } from "@/db/schema"
import { asc, eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import Link from "next/link"
import PlanDetail from "./plan-detail"

type Props = { params: Promise<{ id: string }> }

export default async function PlanPage({ params }: Props) {
  const { id } = await params
  const [plan] = await db.select().from(datePlans).where(eq(datePlans.id, id))
  if (!plan) notFound()

  const place = plan.placeId
    ? (await db.select().from(places).where(eq(places.id, plan.placeId)))[0] ?? null
    : null

  const checklist = plan.checklistId
    ? (await db.select().from(checklists).where(eq(checklists.id, plan.checklistId)))[0] ?? null
    : null

  const items = checklist
    ? await db.select().from(checklistItems).where(eq(checklistItems.checklistId, checklist.id)).orderBy(asc(checklistItems.position))
    : []

  return (
    <div className="space-y-5">
      <Link href="/plans" className="text-sm text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300">← Plans</Link>
      <PlanDetail plan={plan} place={place} checklist={checklist} items={items} />
    </div>
  )
}
