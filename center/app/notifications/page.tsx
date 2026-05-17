export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { db } from "@/db"
import { notifications } from "@/db/schema"
import { desc, eq } from "drizzle-orm"
import { markAllRead } from "./actions"

export default async function NotificationsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const userId = session.user?.email ?? "default"

  const items = await db
    .select()
    .from(notifications)
    .where(eq(notifications.user_id, userId))
    .orderBy(desc(notifications.created_at))
    .limit(50)

  const unread = items.filter((n) => !n.read_at).length

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-3 text-sm">
          <Link href="/dashboard" className="text-neutral-500 hover:text-neutral-100 transition-colors">
            ← Dashboard
          </Link>
          <span className="text-neutral-700">/</span>
          <span className="font-medium">Notifications</span>
          {unread > 0 && (
            <span className="text-xs bg-neutral-700 text-neutral-300 rounded-full px-2 py-0.5">
              {unread} unread
            </span>
          )}
        </div>
        {unread > 0 && (
          <form action={markAllRead.bind(null, userId)}>
            <button type="submit" className="text-xs text-neutral-500 hover:text-neutral-100 transition-colors">
              Mark all read
            </button>
          </form>
        )}
      </header>

      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        {items.length === 0 ? (
          <p className="text-sm text-neutral-500 mt-8 text-center">No notifications yet.</p>
        ) : (
          <ul className="space-y-px mt-2">
            {items.map((n) => (
              <li
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 rounded-lg transition-colors ${
                  n.read_at ? "opacity-50" : "bg-neutral-900"
                }`}
              >
                <span
                  className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                    n.read_at ? "bg-neutral-700" : "bg-blue-500"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-neutral-200">{n.title}</span>
                    <span className="text-xs text-neutral-600 shrink-0">
                      {new Date(n.created_at).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-400 mt-0.5">{n.body}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {n.source_module && (
                      <span className="text-xs text-neutral-600">from {n.source_module}</span>
                    )}
                    {n.link && (
                      <Link
                        href={n.link}
                        className="text-xs text-neutral-400 underline hover:text-neutral-100"
                      >
                        View →
                      </Link>
                    )}
                  </div>
                </div>
                {!n.read_at && (
                  <form action={`/api/notify/${n.id}/read`} method="POST" className="shrink-0">
                    <button
                      type="submit"
                      className="text-xs text-neutral-700 hover:text-neutral-400 transition-colors"
                    >
                      ✓
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
