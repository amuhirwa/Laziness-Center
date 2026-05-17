import { NextResponse } from "next/server"
import { db } from "@/db"
import { modules } from "@/db/schema"
import { eq } from "drizzle-orm"
import { parseManifest } from "@/lib/manifest"

// Public endpoint — no auth required.
// Returns enabled proxy_subpath and iframe modules for the shared top bar.
// Linked modules are excluded (they open in new tabs, not part of in-app nav).
export async function GET() {
  const all = await db.select().from(modules).where(eq(modules.enabled, true))

  const result = all.flatMap((mod) => {
    const parsed = parseManifest(mod.manifest_yaml)
    if (!parsed.success) return []
    if (parsed.data.type === "linked") return []
    return [{ id: parsed.data.id, name: parsed.data.name, url: parsed.data.url }]
  })

  return NextResponse.json({ modules: result }, {
    headers: { "Cache-Control": "public, max-age=60" },
  })
}
