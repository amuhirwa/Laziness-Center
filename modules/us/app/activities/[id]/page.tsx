export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { db } from "@/db"
import { activities, reactions, comments, places, wishlistItems } from "@/db/schema"
import { and, asc, eq } from "drizzle-orm"
import Link from "next/link"
import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { getUserId } from "@/lib/identity"
import ActivityDetail from "./activity-detail"

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const [item] = await db.select({ title: activities.title }).from(activities).where(eq(activities.id, id))
  return { title: item ? `${item.title} — Laziness Center` : "Us — Laziness Center" }
}

export default async function ActivityPage({ params }: Props) {
  const { id } = await params
  const [item] = await db.select().from(activities).where(eq(activities.id, id))
  if (!item) notFound()

  const reacts = await db.select().from(reactions)
    .where(and(eq(reactions.itemType, "activity"), eq(reactions.itemId, id)))
  const commentRows = await db.select().from(comments)
    .where(and(eq(comments.itemType, "activity"), eq(comments.itemId, id)))
    .orderBy(asc(comments.createdAt))

  const userId = getUserId(await headers())
  const hasReacted = reacts.some((r) => r.reactor === userId)

  // Resolve linked item name server-side
  let linkedName: string | null = null
  if (item.linkedType === "place" && item.linkedId) {
    const [p] = await db.select({ name: places.name }).from(places).where(eq(places.id, item.linkedId))
    linkedName = p?.name ?? null
  } else if (item.linkedType === "wishlist" && item.linkedId) {
    const [w] = await db.select({ title: wishlistItems.title }).from(wishlistItems).where(eq(wishlistItems.id, item.linkedId))
    linkedName = w?.title ?? null
  }

  return (
    <div className="space-y-5">
      <Link href="/activities" className="text-sm text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300">← Back</Link>
      <ActivityDetail item={item} reactions={reacts} initialComments={commentRows} hasReacted={hasReacted} linkedName={linkedName} />
    </div>
  )
}
