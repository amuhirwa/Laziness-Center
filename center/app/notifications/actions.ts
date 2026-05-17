"use server"

import { db } from "@/db"
import { notifications } from "@/db/schema"
import { and, eq, isNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function markAllRead(userId: string) {
  await db
    .update(notifications)
    .set({ read_at: new Date() })
    .where(and(eq(notifications.user_id, userId), isNull(notifications.read_at)))
  revalidatePath("/notifications")
}
