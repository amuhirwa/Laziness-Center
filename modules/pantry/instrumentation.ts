import type { LCEvent } from "@lc/sdk"

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  // ── Bootstrap DB schema ───────────────────────────────────────────────────
  const { db } = await import("./db")
  const { sql } = await import("drizzle-orm")

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS inventory (
      id               SERIAL       PRIMARY KEY,
      user_id          TEXT         NOT NULL DEFAULT '',
      name_normalized  TEXT         NOT NULL,
      name_display     TEXT         NOT NULL,
      quantity         NUMERIC(10,3) NOT NULL DEFAULT 0,
      unit             TEXT         NOT NULL,
      low_stock_threshold NUMERIC(10,3),
      last_updated     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS purchases (
      id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      items_json   JSONB       NOT NULL,
      total_cost   NUMERIC(10,2),
      currency     TEXT        NOT NULL DEFAULT 'RWF',
      purchased_at TIMESTAMPTZ NOT NULL,
      user_id      TEXT        NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS consumption_log (
      id               SERIAL       PRIMARY KEY,
      name_normalized  TEXT         NOT NULL,
      quantity         NUMERIC(10,3),
      unit             TEXT,
      source           TEXT         NOT NULL,
      source_ref       TEXT,
      notes            TEXT,
      consumed_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS processed_events (
      event_id     TEXT        PRIMARY KEY,
      processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  // ── Schema migrations (idempotent) ───────────────────────────────────────
  await db.execute(sql`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS always_available BOOLEAN NOT NULL DEFAULT false`)
  await db.execute(sql`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT ''`)
  // Drop the old single-column unique, add composite unique (user_id, name_normalized).
  // IF NOT EXISTS on indexes avoids re-creation on subsequent restarts.
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_name_normalized_key;
    EXCEPTION WHEN others THEN NULL;
    END $$
  `)
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS inventory_user_name_idx
    ON inventory (user_id, name_normalized)
  `)

  // ── Currency migration: USD → RWF ─────────────────────────────────────────
  // Fix the column default on existing tables (CREATE TABLE IF NOT EXISTS won't update it).
  // Update any dev-era rows that were written with the old USD default.
  await db.execute(sql`ALTER TABLE purchases ALTER COLUMN currency SET DEFAULT 'RWF'`)
  await db.execute(sql`UPDATE purchases SET currency = 'RWF' WHERE currency = 'USD'`)

  // ── Subscribe to meals.recipe.cooked (stream) ─────────────────────────────
  const { lc } = await import("./lib/sdk")
  const { normalizeIngredient } = await import("./lib/normalize")
  const { convertUnit } = await import("./lib/units")
  const { inventory, consumptionLog, processedEvents } = await import("./db/schema")
  const { and, eq, inArray } = await import("drizzle-orm")

  lc.subscribe(
    "meals.recipe.cooked",
    async (event: LCEvent) => {
      // Idempotency — skip if already processed
      const already = await db
        .select()
        .from(processedEvents)
        .where(eq(processedEvents.eventId, event.id))
      if (already.length > 0) return

      const { recipeId, userId: cookUserId = "", ingredients } = event.data as {
        recipeId: string
        userId?: string
        servings: number
        ingredients: Array<{ name: string; quantity: number; unit: string }>
      }

      const changedItems: string[] = []

      for (const ing of ingredients) {
        const norm = normalizeIngredient(ing.name)

        const [inv] = await db
          .select()
          .from(inventory)
          .where(and(eq(inventory.userId, cookUserId), eq(inventory.nameNormalized, norm)))

        if (!inv) {
          await db.insert(consumptionLog).values({
            nameNormalized: norm,
            quantity: String(ing.quantity),
            unit: ing.unit,
            source: "recipe-partial",
            sourceRef: recipeId,
            notes: "not in inventory",
          })
          continue
        }

        const converted = convertUnit(ing.quantity, ing.unit, inv.unit)
        if (converted === null) {
          await db.insert(consumptionLog).values({
            nameNormalized: norm,
            quantity: String(ing.quantity),
            unit: ing.unit,
            source: "recipe-partial",
            sourceRef: recipeId,
            notes: `unit mismatch — recipe: ${ing.unit}, pantry: ${inv.unit}`,
          })
          continue
        }

        const newQty = Math.max(0, parseFloat(inv.quantity as string) - converted)
        await db
          .update(inventory)
          .set({ quantity: String(newQty), lastUpdated: new Date() })
          .where(eq(inventory.id, inv.id))

        await db.insert(consumptionLog).values({
          nameNormalized: norm,
          quantity: String(converted),
          unit: inv.unit,
          source: "recipe",
          sourceRef: recipeId,
        })

        changedItems.push(ing.name)
      }

      // Mark processed
      await db.insert(processedEvents).values({ eventId: event.id })

      // Publish pantry.inventory.changed if anything was updated
      if (changedItems.length > 0) {
        await lc.publish({
          event: "pantry.inventory.changed",
          data: { changedItems },
          transport: "pubsub",
        })
      }
    },
    { transport: "stream" }
  )

  await lc.startSubscriptions()
}
