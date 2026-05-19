import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { inventory } from "@/db/schema"
import { asc, eq } from "drizzle-orm"
import { normalizeIngredient } from "@/lib/normalize"
import { getUserId } from "@/lib/identity"

export async function GET(request: NextRequest) {
  const userId = getUserId(request.headers)
  const rows = await db.select().from(inventory)
    .where(eq(inventory.userId, userId))
    .orderBy(asc(inventory.nameDisplay))
  return NextResponse.json({ items: rows })
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { name?: string; unit?: string; alwaysAvailable?: boolean }
  if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 })

  const userId = getUserId(request.headers)
  const nameNormalized = normalizeIngredient(body.name.trim())
  const nameDisplay = body.name.trim()
  const unit = body.unit?.trim() || "pcs"
  const alwaysAvailable = body.alwaysAvailable ?? false

  const [item] = await db
    .insert(inventory)
    .values({ userId, nameNormalized, nameDisplay, quantity: "0", unit, alwaysAvailable })
    .onConflictDoUpdate({
      target: [inventory.userId, inventory.nameNormalized],
      set: { alwaysAvailable, lastUpdated: new Date() },
    })
    .returning()

  return NextResponse.json(item, { status: 201 })
}
