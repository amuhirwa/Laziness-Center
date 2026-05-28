export const dynamic = "force-dynamic"

import { db } from "@/db"
import { wishlistItems, reactions } from "@/db/schema"
import { desc, eq, isNotNull, sql } from "drizzle-orm"
import Link from "next/link"
import { headers } from "next/headers"
import { getUserId } from "@/lib/identity"
import WishlistActions from "./wishlist-actions"
import TurnBanner from "@/app/components/turn-banner"

const STATUSES = ["wanted", "bought", "received", "passed"] as const
type Status = typeof STATUSES[number]

type Props = { searchParams: Promise<{ status?: string }> }

export default async function WishlistPage({ searchParams }: Props) {
  const { status: rawStatus } = await searchParams
  const status = (STATUSES.includes(rawStatus as Status) ? rawStatus : "wanted") as Status
  const userId = getUserId(await headers())

  const rows = await db.select().from(wishlistItems)
    .where(eq(wishlistItems.status, status))
    .orderBy(desc(wishlistItems.isPinned), desc(wishlistItems.createdAt))

  // Budget totals (all statuses)
  const budgetRows = await db
    .select({
      status: wishlistItems.status,
      currency: wishlistItems.currency,
      total: sql<string>`COALESCE(SUM(price),0)`,
    })
    .from(wishlistItems)
    .where(isNotNull(wishlistItems.price))
    .groupBy(wishlistItems.status, wishlistItems.currency)

  // Collapse to { status -> { currency -> total } }
  const budgetMap: Record<string, Record<string, number>> = {}
  for (const r of budgetRows) {
    if (!budgetMap[r.status]) budgetMap[r.status] = {}
    const cur = r.currency ?? "RWF"
    budgetMap[r.status][cur] = (budgetMap[r.status][cur] ?? 0) + parseFloat(r.total)
  }

  function fmtBudget(statusKey: string) {
    const m = budgetMap[statusKey]
    if (!m) return null
    return Object.entries(m)
      .filter(([, v]) => v > 0)
      .map(([cur, val]) => `${cur} ${val.toLocaleString()}`)
      .join(" + ")
  }

  // Reaction counts
  const reactCounts = await db.select({ itemId: reactions.itemId }).from(reactions)
    .where(eq(reactions.itemType, "wishlist"))
  const reactMap = new Map<string, number>()
  reactCounts.forEach((r) => reactMap.set(r.itemId, (reactMap.get(r.itemId) ?? 0) + 1))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold">Wishlist</h1>
      </div>

      <TurnBanner category="wishlists" />
      <WishlistActions />

      {/* Budget summary */}
      {Object.keys(budgetMap).length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
          {[["wanted", "Wanted"], ["bought", "Bought"], ["received", "Received"]].map(([key, label]) => {
            const fmt = fmtBudget(key)
            return fmt ? <span key={key}>{label}: <span className="text-neutral-700 dark:text-neutral-300 font-medium">{fmt}</span></span> : null
          })}
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-1">
        {STATUSES.map((s) => (
          <Link key={s} href={`/wishlists?status=${s}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
              s === status
                ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}>
            {s}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">Nothing {status} yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((item) => (
            <Link key={item.id} href={`/wishlists/${item.id}`}
              className="flex gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt={item.title} className="w-16 h-16 object-cover rounded-lg shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm leading-tight line-clamp-1">{item.title}</p>
                {item.description && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1">{item.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1.5">
                  {item.price && (
                    <span className="text-xs text-neutral-500">{item.currency ?? ""} {item.price}</span>
                  )}
                  {(reactMap.get(item.id) ?? 0) > 0 && (
                    <span className="text-xs text-pink-500">♡ {reactMap.get(item.id)}</span>
                  )}
                  {item.isPinned && <span className="text-xs text-yellow-500">★</span>}
                  {item.hiddenFrom && item.addedBy === userId && (
                    <span className="text-xs" title="Hidden from partner">🎁</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
