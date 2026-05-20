import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { wishlistItems } from "@/db/schema"
import { desc, eq } from "drizzle-orm"
import { getUserId } from "@/lib/identity"
import { logActivity } from "@/lib/activity"

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status") ?? "wanted"
  const rows = status === "all"
    ? await db.select().from(wishlistItems).orderBy(desc(wishlistItems.isPinned), desc(wishlistItems.createdAt))
    : await db.select().from(wishlistItems)
        .where(eq(wishlistItems.status, status))
        .orderBy(desc(wishlistItems.isPinned), desc(wishlistItems.createdAt))

  return NextResponse.json({ items: rows })
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    title?: string; description?: string; url?: string; imageUrl?: string
    price?: number; currency?: string; category?: string
  }
  if (!body.title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 })

  const actor = getUserId(request.headers)
  const [row] = await db.insert(wishlistItems).values({
    title: body.title.trim(),
    description: body.description?.trim() ?? null,
    url: body.url ?? null,
    imageUrl: body.imageUrl ?? null,
    price: body.price != null ? String(body.price) : null,
    currency: body.currency ?? null,
    category: body.category ?? null,
    addedBy: actor,
  }).returning()

  await logActivity({ kind: "added", section: "wishlist", actor, itemId: row.id, itemTitle: row.title })
  return NextResponse.json(row, { status: 201 })
}
