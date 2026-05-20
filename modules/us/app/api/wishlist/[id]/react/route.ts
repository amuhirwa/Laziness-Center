import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { reactions, wishlistItems } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { getUserId } from "@/lib/identity"
import { logActivity } from "@/lib/activity"

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params
  const reactor = getUserId(request.headers)

  await db.insert(reactions).values({ itemType: "wishlist", itemId: id, reactor })
    .onConflictDoNothing()

  const [item] = await db.select({ title: wishlistItems.title }).from(wishlistItems).where(eq(wishlistItems.id, id))
  await logActivity({ kind: "reacted", section: "wishlist", actor: reactor, itemId: id, itemTitle: item?.title })

  return new NextResponse(null, { status: 204 })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params
  const reactor = getUserId(request.headers)
  await db.delete(reactions)
    .where(and(eq(reactions.itemType, "wishlist"), eq(reactions.itemId, id), eq(reactions.reactor, reactor)))
  return new NextResponse(null, { status: 204 })
}
