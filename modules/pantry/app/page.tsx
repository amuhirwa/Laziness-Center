import { db } from "@/db"
import { inventory } from "@/db/schema"
import { asc } from "drizzle-orm"
import Link from "next/link"

export default async function InventoryPage() {
  const items = await db.select().from(inventory).orderBy(asc(inventory.nameDisplay))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold">Inventory</h1>
        <Link
          href="/pantry/purchase"
          className="text-sm px-4 py-1.5 bg-neutral-100 text-neutral-900 rounded-md font-medium hover:bg-white transition-colors"
        >
          + Log purchase
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No items yet.{" "}
          <Link href="/pantry/purchase" className="text-neutral-300 underline hover:text-white">
            Log your first purchase
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-px">
          <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 text-xs text-neutral-600 uppercase tracking-wide border-b border-neutral-800">
            <span>Item</span>
            <span className="text-right w-20">Quantity</span>
            <span className="text-right w-14">Unit</span>
            <span className="text-right w-28">Last updated</span>
          </div>
          {items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-1 sm:gap-4 items-center
                         px-4 py-3 border-b border-neutral-800 hover:bg-neutral-900 transition-colors"
            >
              <span className="text-sm font-medium">{item.nameDisplay}</span>
              <span className="text-sm font-mono text-right sm:w-20">
                {parseFloat(item.quantity as string).toLocaleString()}
              </span>
              <span className="text-sm text-neutral-500 text-right sm:w-14">{item.unit}</span>
              <span className="text-xs text-neutral-600 text-right sm:w-28">
                {new Date(item.lastUpdated).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
