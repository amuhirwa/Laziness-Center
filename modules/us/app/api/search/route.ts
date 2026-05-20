import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { checklists, checklistItems, wishlistItems, places, comments } from "@/db/schema"
import { sql, ilike, or } from "drizzle-orm"

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim()
  if (!q || q.length < 2) return NextResponse.json({ checklists: [], checklistItems: [], wishlist: [], places: [], comments: [] })

  const pattern = `%${q}%`

  const [clRows, ciRows, wiRows, plRows, cmRows] = await Promise.all([
    db.select({ id: checklists.id, name: checklists.name }).from(checklists)
      .where(ilike(checklists.name, pattern)).limit(10),
    db.select({ id: checklistItems.id, text: checklistItems.text, checklistId: checklistItems.checklistId }).from(checklistItems)
      .where(or(ilike(checklistItems.text, pattern), ilike(checklistItems.notes, pattern))).limit(10),
    db.select({ id: wishlistItems.id, title: wishlistItems.title, status: wishlistItems.status }).from(wishlistItems)
      .where(or(ilike(wishlistItems.title, pattern), ilike(wishlistItems.description, pattern))).limit(10),
    db.select({ id: places.id, name: places.name, status: places.status }).from(places)
      .where(or(ilike(places.name, pattern), ilike(places.description, pattern), ilike(places.location, pattern))).limit(10),
    db.select({ id: comments.id, body: comments.body, itemType: comments.itemType, itemId: comments.itemId }).from(comments)
      .where(ilike(comments.body, pattern)).limit(10),
  ])

  return NextResponse.json({ checklists: clRows, checklistItems: ciRows, wishlist: wiRows, places: plRows, comments: cmRows })
}
