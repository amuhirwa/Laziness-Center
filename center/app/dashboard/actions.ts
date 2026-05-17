"use server"

import { db } from "@/db"
import { userPreferences } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const WidgetRefSchema = z.object({ moduleId: z.string(), widgetId: z.string() })
type WidgetRef = z.infer<typeof WidgetRefSchema>

async function getWidgetOrder(userId: string): Promise<WidgetRef[]> {
  const [pref] = await db
    .select()
    .from(userPreferences)
    .where(
      and(
        eq(userPreferences.user_id, userId),
        eq(userPreferences.key, "dashboard_widget_order")
      )
    )
  if (!pref?.value_json) return []
  const result = z.array(WidgetRefSchema).safeParse(pref.value_json)
  return result.success ? result.data : []
}

async function saveWidgetOrder(userId: string, order: WidgetRef[]) {
  await db
    .insert(userPreferences)
    .values({ user_id: userId, key: "dashboard_widget_order", value_json: order })
    .onConflictDoUpdate({
      target: [userPreferences.user_id, userPreferences.key],
      set: { value_json: order },
    })
}

/**
 * Move a widget up or down in the dashboard.
 *
 * `currentOrder` is the full ordered list as rendered on this page load — passed
 * from the server component so the action doesn't have to re-derive it.
 */
export async function moveWidget(
  userId: string,
  moduleId: string,
  widgetId: string,
  direction: "up" | "down",
  currentOrder: WidgetRef[]
) {
  const idx = currentOrder.findIndex(
    (w) => w.moduleId === moduleId && w.widgetId === widgetId
  )
  if (idx === -1) return

  const next = [...currentOrder]
  if (direction === "up" && idx > 0) {
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
  } else if (direction === "down" && idx < next.length - 1) {
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
  } else {
    return // already at boundary
  }

  await saveWidgetOrder(userId, next)
  revalidatePath("/dashboard")
}

export { getWidgetOrder }
