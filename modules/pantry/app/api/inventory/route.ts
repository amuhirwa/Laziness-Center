import { NextResponse } from "next/server"
import { db } from "@/db"
import { inventory } from "@/db/schema"
import { asc } from "drizzle-orm"

export async function GET() {
  const rows = await db.select().from(inventory).orderBy(asc(inventory.nameDisplay))
  return NextResponse.json({ items: rows })
}
