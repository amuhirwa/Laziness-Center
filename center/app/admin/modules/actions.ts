"use server"

import { db } from "@/db"
import { modules } from "@/db/schema"
import { parseManifest } from "@/lib/manifest"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function registerModule(
  yaml: string
): Promise<{ success: true } | { error: string }> {
  const result = parseManifest(yaml)
  if (!result.success) return { error: result.error }

  await db
    .insert(modules)
    .values({ id: result.data.id, manifest_yaml: yaml, enabled: true })
    .onConflictDoUpdate({
      target: modules.id,
      set: { manifest_yaml: yaml },
    })

  revalidatePath("/admin/modules")
  revalidatePath("/launcher")
  return { success: true }
}

export async function deleteModule(moduleId: string) {
  await db.delete(modules).where(eq(modules.id, moduleId))
  revalidatePath("/admin/modules")
  revalidatePath("/launcher")
}

export async function toggleModule(moduleId: string, enabled: boolean) {
  await db.update(modules).set({ enabled }).where(eq(modules.id, moduleId))
  revalidatePath("/admin/modules")
  revalidatePath("/launcher")
}

export async function pingModuleHealth(moduleId: string) {
  const [mod] = await db.select().from(modules).where(eq(modules.id, moduleId))
  if (!mod) return

  const parsed = parseManifest(mod.manifest_yaml)
  // health_check must be a full http(s) URL (see manifest-schema.ts)
  if (!parsed.success || !parsed.data.health_check) return

  let status: "up" | "down"
  try {
    const res = await fetch(parsed.data.health_check, {
      signal: AbortSignal.timeout(3000),
    })
    status = res.ok ? "up" : "down"
  } catch {
    status = "down"
  }

  await db
    .update(modules)
    .set({ last_health_status: status, last_health_check: new Date() })
    .where(eq(modules.id, moduleId))

  revalidatePath("/admin/modules")
}
