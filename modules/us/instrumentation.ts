async function runNudgeChecks() {
  try {
    const { db } = await import("./db")
    const { lc } = await import("./lib/sdk")
    const { wishlistItems, placeVisits, datePlans, places, activity, checklistItems, checklists } = await import("./db/schema")
    const { eq, lt, desc, and, gte, lte } = await import("drizzle-orm")
    // Use ioredis for dedup keys
    const { default: IORedis } = await import("ioredis")
    const redisClient = new IORedis(process.env.REDIS_URL ?? `redis://:${encodeURIComponent(process.env.REDIS_PASSWORD ?? "")}@${process.env.REDIS_HOST ?? "redis"}:${process.env.REDIS_PORT ?? "6379"}`)

    async function shouldSend(key: string): Promise<boolean> {
      const val = await redisClient.get(`us:nudge:${key}:last`)
      return !val
    }
    async function markSent(key: string) {
      await redisClient.set(`us:nudge:${key}:last`, new Date().toISOString(), "EX", 48 * 3600)
    }

    async function notify(userId: string, title: string, body: string, link: string) {
      try {
        await lc.call("center", { method: "POST", path: "/api/notify", body: { userId, title, body, link } })
      } catch { /* notification is non-critical */ }
    }

    // Find distinct users from recent activity
    const recent = await db.select({ actor: activity.actor }).from(activity).orderBy(desc(activity.createdAt)).limit(100)
    const users = [...new Set(recent.map((r) => r.actor))].filter((a) => a && a !== "guest@lovey.tv").slice(0, 2)
    if (users.length === 0) { redisClient.quit(); return }

    const now = new Date()
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400_000)
    const twentyOneDaysAgo = new Date(now.getTime() - 21 * 86400_000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400_000)
    const today = now.toISOString().slice(0, 10)
    const tomorrow = new Date(now.getTime() + 86400_000).toISOString().slice(0, 10)

    // 1. Stale wishlist items
    if (await shouldSend("stale-wishlist")) {
      const staleItems = await db.select({ id: wishlistItems.id, title: wishlistItems.title })
        .from(wishlistItems)
        .where(and(eq(wishlistItems.status, "wanted"), lt(wishlistItems.createdAt, sixtyDaysAgo)))
        .limit(3)
      if (staleItems.length > 0) {
        const titles = staleItems.map((i) => i.title).join(", ")
        for (const user of users) {
          await notify(user, "Still on your wishlist 👀", `${staleItems.length} item${staleItems.length > 1 ? "s" : ""} have been wanted for 60+ days: ${titles}`, "/us/wishlists")
        }
        await markSent("stale-wishlist")
      }
    }

    // 2. No new place visits in 3 weeks
    if (await shouldSend("no-place-visit")) {
      const lastVisit = await db.select({ visitedAt: placeVisits.visitedAt }).from(placeVisits).orderBy(desc(placeVisits.visitedAt)).limit(1)
      if (lastVisit.length === 0 || lastVisit[0].visitedAt < twentyOneDaysAgo) {
        const wantToGo = await db.select({ name: places.name }).from(places).where(eq(places.status, "wantToGo")).limit(3)
        const suggestions = wantToGo.map((p) => p.name).join(", ")
        for (const user of users) {
          await notify(user, "Time to explore! 🗺️", `You haven't visited a new place in 3 weeks.${suggestions ? ` How about: ${suggestions}?` : ""}`, "/us/places")
        }
        await markSent("no-place-visit")
      }
    }

    // 3. Upcoming date plans
    if (await shouldSend("upcoming-plan")) {
      const upcomingPlans = await db.select({ id: datePlans.id, title: datePlans.title, date: datePlans.date, placeId: datePlans.placeId })
        .from(datePlans)
        .where(and(gte(datePlans.date, today), lte(datePlans.date, tomorrow)))
        .limit(1)
      if (upcomingPlans.length > 0) {
        const plan = upcomingPlans[0]
        const daysUntil = plan.date === today ? 0 : 1
        const placeRow = plan.placeId ? (await db.select({ name: places.name }).from(places).where(eq(places.id, plan.placeId)))[0] : null
        const when = daysUntil === 0 ? "today" : "tomorrow"
        for (const user of users) {
          await notify(user, `${plan.title} ${when}! 🎉`, placeRow ? `📍 ${placeRow.name}` : "You have a plan coming up!", `/us/plans/${plan.id}`)
        }
        await markSent("upcoming-plan")
      }
    }

    // 4. Idle checklists (no completions in 14 days)
    if (await shouldSend("idle-checklist")) {
      const allActive = await db.select({ id: checklists.id, name: checklists.name })
        .from(checklists).where(and(eq(checklists.isArchived, false), eq(checklists.isTemplate, false)))
      const idle = (await Promise.all(allActive.map(async (cl) => {
        const lastCompletion = await db.select({ completedAt: checklistItems.completedAt })
          .from(checklistItems)
          .where(and(eq(checklistItems.checklistId, cl.id), eq(checklistItems.completed, true)))
          .orderBy(desc(checklistItems.completedAt)).limit(1)
        const remaining = await db.select({ id: checklistItems.id })
          .from(checklistItems)
          .where(and(eq(checklistItems.checklistId, cl.id), eq(checklistItems.completed, false)))
          .limit(1)
        if (remaining.length === 0) return null // fully done
        if (lastCompletion.length === 0 || (lastCompletion[0].completedAt && lastCompletion[0].completedAt < fourteenDaysAgo)) {
          return cl
        }
        return null
      }))).filter(Boolean) as { id: string; name: string }[]

      if (idle.length > 0) {
        const names = idle.slice(0, 2).map((c) => c.name).join(", ")
        for (const user of users) {
          await notify(user, "Checklist needs attention 📋", `"${names}" ha${idle.length === 1 ? "s" : "ve"} been idle for 2+ weeks`, "/us/checklists")
        }
        await markSent("idle-checklist")
      }
    }

    redisClient.quit()
  } catch (e) {
    console.error("[us nudge] error", e)
  }
}

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

  // ── v2 schema additions ───────────────────────────────────────────────────
  await db.execute(sql`ALTER TABLE checklists ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false`)

  await db.execute(sql`ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS hidden_from TEXT`)
  await db.execute(sql`ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS extra_images TEXT[] NOT NULL DEFAULT '{}'`)

  await db.execute(sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS address TEXT`)
  await db.execute(sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS lat NUMERIC(10,7)`)
  await db.execute(sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS lng NUMERIC(10,7)`)
  await db.execute(sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS extra_images TEXT[] NOT NULL DEFAULT '{}'`)

  await db.execute(sql`ALTER TABLE place_visits ADD COLUMN IF NOT EXISTS mood TEXT`)
  await db.execute(sql`ALTER TABLE place_visits ADD COLUMN IF NOT EXISTS photo_urls TEXT[] NOT NULL DEFAULT '{}'`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS date_plans (
      id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      title        TEXT        NOT NULL,
      date         DATE        NOT NULL,
      place_id     TEXT,
      checklist_id TEXT,
      notes        TEXT,
      created_by   TEXT        NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS dp_date ON date_plans (date)`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS turns (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      category        TEXT        NOT NULL UNIQUE,
      current_user_id TEXT        NOT NULL,
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  // ── Smart nudges ─────────────────────────────────────────────────────────
  // First check 30s after startup, then every 6 hours
  setTimeout(() => {
    runNudgeChecks()
    setInterval(runNudgeChecks, 6 * 60 * 60 * 1000)
  }, 30_000)
}
