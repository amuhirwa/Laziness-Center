export const dynamic = "force-dynamic"

import { db } from "@/db"
import { wishlistItems, reactions, comments } from "@/db/schema"
import { and, asc, eq } from "drizzle-orm"
import Link from "next/link"
import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { getUserId } from "@/lib/identity"
import WishlistItemDetail from "./wishlist-item-detail"

type Props = { params: Promise<{ id: string }> }

export default async function WishlistItemPage({ params }: Props) {
  const { id } = await params
  const [item] = await db.select().from(wishlistItems).where(eq(wishlistItems.id, id))
  if (!item) notFound()

  const reacts = await db.select().from(reactions)
    .where(and(eq(reactions.itemType, "wishlist"), eq(reactions.itemId, id)))
  const commentRows = await db.select().from(comments)
    .where(and(eq(comments.itemType, "wishlist"), eq(comments.itemId, id)))
    .orderBy(asc(comments.createdAt))

  const userId = getUserId(await headers())
  const hasReacted = reacts.some((r) => r.reactor === userId)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/wishlists" className="text-sm text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300">← Back</Link>
      </div>
      <WishlistItemDetail item={item} reactions={reacts} initialComments={commentRows} hasReacted={hasReacted} />
    </div>
  )
}
