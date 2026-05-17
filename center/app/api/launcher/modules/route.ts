import { NextResponse } from "next/server"
import { db } from "@/db"
import { modules } from "@/db/schema"
import { eq } from "drizzle-orm"
import { parseManifest } from "@/lib/manifest"

// Used by the command palette — returns all enabled modules including linked.
// Public; data is non-sensitive (names and URLs only).
export async function GET() {
  const all = await db.select().from(modules).where(eq(modules.enabled, true))

  const result = all.flatMap((mod) => {
    const parsed = parseManifest(mod.manifest_yaml)
    if (!parsed.success) return []
    return [{
      id: parsed.data.id,
      name: parsed.data.name,
      description: parsed.data.description,
      url: parsed.data.url,
      type: parsed.data.type,
    }]
  })

  return NextResponse.json({ modules: result }, {
    headers: { "Cache-Control": "public, max-age=30" },
  })
}
