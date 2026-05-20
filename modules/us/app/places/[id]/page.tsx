export const dynamic = "force-dynamic"

import { db } from "@/db"
import { places, placeVisits, reactions, comments } from "@/db/schema"
import { and, asc, desc, eq } from "drizzle-orm"
import Link from "next/link"
import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { getUserId } from "@/lib/identity"
import PlaceDetail from "./place-detail"

type Props = { params: Promise<{ id: string }> }

export default async function PlacePage({ params }: Props) {
  const { id } = await params
  const [place] = await db.select().from(places).where(eq(places.id, id))
  if (!place) notFound()

  const visits = await db.select().from(placeVisits).where(eq(placeVisits.placeId, id)).orderBy(desc(placeVisits.visitedAt))
  const reacts = await db.select().from(reactions).where(and(eq(reactions.itemType, "place"), eq(reactions.itemId, id)))
  const commentRows = await db.select().from(comments)
    .where(and(eq(comments.itemType, "place"), eq(comments.itemId, id)))
    .orderBy(asc(comments.createdAt))

  const userId = getUserId(await headers())
  const hasReacted = reacts.some((r) => r.reactor === userId)

  return (
    <div className="space-y-5">
      <Link href="/us/places" className="text-sm text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300">← Back</Link>
      <PlaceDetail place={place} visits={visits} reactions={reacts} initialComments={commentRows} hasReacted={hasReacted} />
    </div>
  )
}
