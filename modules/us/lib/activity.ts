import { db } from "@/db"
import { activity } from "@/db/schema"

type Kind = "added" | "status-changed" | "reacted" | "completed" | "commented" | "visited" | "archived"
type Section = "checklist" | "wishlist" | "places"

export async function logActivity(opts: {
  kind: Kind
  section: Section
  actor: string
  itemType?: string
  itemId?: string
  itemTitle?: string
  meta?: Record<string, unknown>
}) {
  try {
    await db.insert(activity).values({
      kind: opts.kind,
      section: opts.section,
      actor: opts.actor,
      itemType: opts.itemType,
      itemId: opts.itemId as string | undefined,
      itemTitle: opts.itemTitle,
      meta: opts.meta ?? null,
    })
  } catch {
    // Activity logging is non-critical — never let it fail a request
  }
}
