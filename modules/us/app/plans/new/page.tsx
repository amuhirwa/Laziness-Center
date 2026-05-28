export const dynamic = "force-dynamic"

import { db } from "@/db"
import { places, checklists } from "@/db/schema"
import { eq } from "drizzle-orm"
import NewPlanForm from "./new-plan-form"

export default async function NewPlanPage() {
  const wantToGoPlaces = await db.select({ id: places.id, name: places.name })
    .from(places).where(eq(places.status, "wantToGo"))

  const activeLists = await db.select({ id: checklists.id, name: checklists.name })
    .from(checklists).where(eq(checklists.isArchived, false))

  return (
    <div className="space-y-5">
      <a href="/us/plans" className="text-sm text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300">← Back</a>
      <h1 className="font-semibold">New plan</h1>
      <NewPlanForm places={wantToGoPlaces} checklists={activeLists} />
    </div>
  )
}
