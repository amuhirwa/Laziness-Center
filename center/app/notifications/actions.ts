"use server"

import { db } from "@/db"
import { notifications } from "@/db/schema"
import { and, eq, isNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function markAllRead(userId: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
  revalidatePath("/notifications")
}
