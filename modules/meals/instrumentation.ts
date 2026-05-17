export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  // ── Bootstrap DB schema ───────────────────────────────────────────────────
  const { db } = await import("./db")
  const { sql } = await import("drizzle-orm")

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS recipes (
      id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      name                 TEXT         NOT NULL,
      time_minutes         INT,
      servings_default     INT          NOT NULL DEFAULT 2,
      difficulty           TEXT         CHECK (difficulty IN ('easy','medium','hard')),
      is_pinned            BOOLEAN      NOT NULL DEFAULT false,
      steps                JSONB        NOT NULL DEFAULT '[]',
      has_structured_steps BOOLEAN      NOT NULL DEFAULT false,
      ingredients          JSONB        NOT NULL DEFAULT '[]',
      meal_types           TEXT[]       NOT NULL DEFAULT '{}',
      tags                 TEXT[]       NOT NULL DEFAULT '{}',
      source_url           TEXT,
      created_by           TEXT         NOT NULL,
      created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cooked_log (
      id              SERIAL       PRIMARY KEY,
      recipe_id       UUID         NOT NULL,
      user_id         TEXT         NOT NULL,
      cooked_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      actual_minutes  INT,
      actual_servings INT,
      rating          INT          CHECK (rating BETWEEN 1 AND 5),
      notes           TEXT
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cook_sessions (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     TEXT        NOT NULL,
      recipe_id   UUID        NOT NULL,
      servings    INT         NOT NULL,
      started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ,
      status      TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','completed','cancelled'))
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS suggestion_cache (
      user_id         TEXT        NOT NULL,
      mealtime_bucket TEXT        NOT NULL,
      suggestions_json JSONB      NOT NULL,
      computed_at     TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (user_id, mealtime_bucket)
    )
  `)

  // ── Subscribe to pantry.inventory.changed (pubsub) ────────────────────────
  const { lc } = await import("./lib/sdk")
  const { suggestionCache } = await import("./db/schema")

  lc.subscribe(
    "pantry.inventory.changed",
    async () => {
      // Invalidate suggestion cache — next /api/suggestions call re-scores with fresh pantry data
      await db.delete(suggestionCache)
    },
    { transport: "pubsub" }
  )

  await lc.startSubscriptions()
}
