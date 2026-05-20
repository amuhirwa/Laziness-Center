export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const { db } = await import("./db")
  const { sql } = await import("drizzle-orm")

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS checklists (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT        NOT NULL,
      description TEXT,
      is_pinned   BOOLEAN     NOT NULL DEFAULT false,
      is_archived BOOLEAN     NOT NULL DEFAULT false,
      archived_at TIMESTAMPTZ,
      created_by  TEXT        NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS checklist_items (
      id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      checklist_id UUID        NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
      text         TEXT        NOT NULL,
      notes        TEXT,
      due_date     TIMESTAMPTZ,
      position     INTEGER     NOT NULL DEFAULT 0,
      completed    BOOLEAN     NOT NULL DEFAULT false,
      completed_at TIMESTAMPTZ,
      completed_by TEXT,
      added_by     TEXT        NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS ci_checklist_pos ON checklist_items (checklist_id, position)`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS wishlist_items (
      id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      title             TEXT        NOT NULL,
      description       TEXT,
      url               TEXT,
      image_url         TEXT,
      price             NUMERIC(12,2),
      currency          TEXT,
      category          TEXT,
      status            TEXT        NOT NULL DEFAULT 'wanted'
                        CHECK (status IN ('wanted','bought','received','passed')),
      is_pinned         BOOLEAN     NOT NULL DEFAULT false,
      added_by          TEXT        NOT NULL,
      status_changed_by TEXT,
      status_changed_at TIMESTAMPTZ,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS wi_status_pin ON wishlist_items (status, is_pinned, created_at DESC)`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS places (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT        NOT NULL,
      location    TEXT,
      description TEXT,
      url         TEXT,
      image_url   TEXT,
      category    TEXT        CHECK (category IS NULL OR category IN
                  ('restaurant','bar','activity','landmark','nature','other')),
      status      TEXT        NOT NULL DEFAULT 'wantToGo'
                  CHECK (status IN ('wantToGo','visited','passed')),
      is_pinned   BOOLEAN     NOT NULL DEFAULT false,
      added_by    TEXT        NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS pl_status_pin ON places (status, is_pinned, created_at DESC)`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS place_visits (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      place_id   UUID        NOT NULL REFERENCES places(id) ON DELETE CASCADE,
      visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      rating     INTEGER     CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
      notes      TEXT,
      logged_by  TEXT        NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS reactions (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      item_type  TEXT        NOT NULL CHECK (item_type IN ('wishlist','place')),
      item_id    UUID        NOT NULL,
      reactor    TEXT        NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (item_type, item_id, reactor)
    )
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS rx_item ON reactions (item_type, item_id)`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS comments (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      item_type  TEXT        NOT NULL CHECK (item_type IN ('checklist-item','wishlist','place')),
      item_id    UUID        NOT NULL,
      body       TEXT        NOT NULL,
      author     TEXT        NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS cm_item ON comments (item_type, item_id, created_at)`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS activity (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      kind       TEXT        NOT NULL,
      section    TEXT        NOT NULL,
      actor      TEXT        NOT NULL,
      item_type  TEXT,
      item_id    UUID,
      item_title TEXT,
      meta       JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS act_created ON activity (created_at DESC)`)

  // ── Full-text search (generated tsvector columns + GIN indexes) ───────────
  await db.execute(sql`
    ALTER TABLE wishlist_items
      ADD COLUMN IF NOT EXISTS search_vec tsvector
      GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))
      ) STORED
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS wi_fts ON wishlist_items USING GIN (search_vec)`)

  await db.execute(sql`
    ALTER TABLE places
      ADD COLUMN IF NOT EXISTS search_vec tsvector
      GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(location,''))
      ) STORED
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS pl_fts ON places USING GIN (search_vec)`)

  await db.execute(sql`
    ALTER TABLE checklist_items
      ADD COLUMN IF NOT EXISTS search_vec tsvector
      GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(text,'') || ' ' || coalesce(notes,''))
      ) STORED
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS ci_fts ON checklist_items USING GIN (search_vec)`)

  await db.execute(sql`
    ALTER TABLE comments
      ADD COLUMN IF NOT EXISTS search_vec tsvector
      GENERATED ALWAYS AS (to_tsvector('english', coalesce(body,''))) STORED
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS cm_fts ON comments USING GIN (search_vec)`)
}
