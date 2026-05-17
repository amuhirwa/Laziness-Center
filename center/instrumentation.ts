// Runs once on server startup (Next.js instrumentation hook).
// Bootstraps the center schema tables idempotently — safe to re-run on every deploy.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { db } = await import("./db")
    const { sql } = await import("drizzle-orm")

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS modules (
        id                 TEXT        PRIMARY KEY,
        manifest_yaml      TEXT        NOT NULL,
        enabled            BOOLEAN     NOT NULL DEFAULT true,
        last_health_check  TIMESTAMPTZ,
        last_health_status TEXT        CHECK (last_health_status IN ('up', 'down'))
      )
    `)

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id    TEXT   NOT NULL,
        key        TEXT   NOT NULL,
        value_json JSONB,
        PRIMARY KEY (user_id, key)
      )
    `)

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id            TEXT        PRIMARY KEY,
        user_id       TEXT        NOT NULL,
        source_module TEXT,
        title         TEXT        NOT NULL,
        body          TEXT        NOT NULL,
        link          TEXT,
        read_at       TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
  }
}
