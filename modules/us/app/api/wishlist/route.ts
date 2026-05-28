import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { wishlistItems } from "@/db/schema"
import { and, desc, eq, isNull, or } from "drizzle-orm"
import { getUserId } from "@/lib/identity"
import { logActivity } from "@/lib/activity"

export async function GET(request: NextRequest) {
  const actor = getUserId(request.headers)
  const status = request.nextUrl.searchParams.get("status") ?? "wanted"
  // Show if not hidden, OR if current user is the one who added it (owner sees their own surprises)
  const visibleFilter = or(isNull(wishlistItems.hiddenFrom), eq(wishlistItems.addedBy, actor))

  const rows = status === "all"
    ? await db.select().from(wishlistItems)
        .where(visibleFilter)
        .orderBy(desc(wishlistItems.isPinned), desc(wishlistItems.createdAt))
    : await db.select().from(wishlistItems)
        .where(and(eq(wishlistItems.status, status), visibleFilter))
        .orderBy(desc(wishlistItems.isPinned), desc(wishlistItems.createdAt))

  return NextResponse.json({ items: rows })
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    title?: string; description?: string; url?: string; imageUrl?: string
    extraImages?: string[]; price?: string | number; currency?: string; category?: string
  }
  if (!body.title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 })

  const actor = getUserId(request.headers)
  const [row] = await db.insert(wishlistItems).values({
    title: body.title.trim(),
    description: body.description?.trim() ?? null,
    url: body.url ?? null,
    imageUrl: body.imageUrl ?? null,
    extraImages: body.extraImages ?? [],
    price: body.price != null ? String(body.price) : null,
    currency: body.currency ?? null,
    category: body.category ?? null,
    addedBy: actor,
  }).returning()

  await logActivity({ kind: "added", section: "wishlist", actor, itemId: row.id, itemTitle: row.title })
  return NextResponse.json(row, { status: 201 })
}
