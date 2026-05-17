import { db } from "@/db"
import { modules } from "@/db/schema"
import { parseManifest } from "@/lib/manifest"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

// GET /internal/registry/services/:id
// Returns the internal API base URL for a registered module.
// Consumed by the SDK's service-discovery step.
// Reachable only from the Docker internal network — Caddy blocks /internal/* publicly.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const [mod] = await db.select().from(modules).where(eq(modules.id, id))

  if (!mod?.enabled) {
    return NextResponse.json({ error: "module not found" }, { status: 404 })
  }

  const parsed = parseManifest(mod.manifest_yaml)
  if (!parsed.success || !parsed.data.internal_api) {
    return NextResponse.json({ error: "module has no internal_api configured" }, { status: 404 })
  }

  return NextResponse.json({ base_url: parsed.data.internal_api })
}
