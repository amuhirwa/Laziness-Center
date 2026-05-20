export const dynamic = "force-dynamic"

import Link from "next/link"
import { db } from "@/db"
import { checklists, checklistItems, wishlistItems, places, comments } from "@/db/schema"
import { ilike, or } from "drizzle-orm"

type Props = { searchParams: Promise<{ q?: string }> }

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams
  const query = q?.trim() ?? ""
  const hasQuery = query.length >= 2

  const pattern = `%${query}%`

  const [clRows, ciRows, wiRows, plRows, cmRows] = hasQuery
    ? await Promise.all([
        db.select({ id: checklists.id, name: checklists.name }).from(checklists)
          .where(ilike(checklists.name, pattern)).limit(8),
        db.select({ id: checklistItems.id, text: checklistItems.text, checklistId: checklistItems.checklistId }).from(checklistItems)
          .where(or(ilike(checklistItems.text, pattern), ilike(checklistItems.notes, pattern))).limit(8),
        db.select({ id: wishlistItems.id, title: wishlistItems.title, status: wishlistItems.status }).from(wishlistItems)
          .where(or(ilike(wishlistItems.title, pattern), ilike(wishlistItems.description, pattern))).limit(8),
        db.select({ id: places.id, name: places.name, status: places.status }).from(places)
          .where(or(ilike(places.name, pattern), ilike(places.description, pattern), ilike(places.location, pattern))).limit(8),
        db.select({ id: comments.id, body: comments.body, itemType: comments.itemType, itemId: comments.itemId }).from(comments)
          .where(ilike(comments.body, pattern)).limit(8),
      ])
    : [[], [], [], [], []]

  const total = clRows.length + ciRows.length + wiRows.length + plRows.length + cmRows.length

  return (
    <div className="space-y-5">
      <h1 className="font-semibold">Search</h1>

      <form method="get" action="/us/search" className="flex gap-2">
        <input name="q" defaultValue={query} autoFocus placeholder="Search everything…"
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500" />
        <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium hover:opacity-90 transition-opacity">Go</button>
      </form>

      {hasQuery && total === 0 && (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">No results for &ldquo;{query}&rdquo;.</p>
      )}

      {clRows.length > 0 && (
        <Section title="Checklists">
          {clRows.map((r) => <ResultRow key={r.id} href={`/us/checklists/${r.id}`} label={r.name} />)}
        </Section>
      )}
      {ciRows.length > 0 && (
        <Section title="Checklist items">
          {ciRows.map((r) => <ResultRow key={r.id} href={`/us/checklists/${r.checklistId}`} label={r.text} />)}
        </Section>
      )}
      {wiRows.length > 0 && (
        <Section title="Wishlist">
          {wiRows.map((r) => <ResultRow key={r.id} href={`/us/wishlists/${r.id}`} label={r.title} badge={r.status} />)}
        </Section>
      )}
      {plRows.length > 0 && (
        <Section title="Places">
          {plRows.map((r) => <ResultRow key={r.id} href={`/us/places/${r.id}`} label={r.name} badge={r.status} />)}
        </Section>
      )}
      {cmRows.length > 0 && (
        <Section title="Comments">
          {cmRows.map((r) => {
            const href = r.itemType === "wishlist" ? `/us/wishlists/${r.itemId}` : r.itemType === "place" ? `/us/places/${r.itemId}` : `/us/checklists/${r.itemId}`
            return <ResultRow key={r.id} href={href} label={r.body} />
          })}
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs uppercase tracking-wide text-neutral-400 dark:text-neutral-500">{title}</p>
      {children}
    </div>
  )
}

function ResultRow({ href, label, badge }: { href: string; label: string; badge?: string | null }) {
  return (
    <Link href={href}
      className="flex items-center justify-between gap-2 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
      <span className="text-sm line-clamp-1">{label}</span>
      {badge && <span className="text-xs text-neutral-400 dark:text-neutral-500 shrink-0 capitalize">{badge}</span>}
    </Link>
  )
}
