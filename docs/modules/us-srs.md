# Module SRS — `us`

**Version:** 0.1
**Date:** 2026-05-19
**Module type:** `proxy_subpath`
**Status:** Draft — awaiting confirmation before implementation

---

## 1. Purpose

A shared space for the two of us — me and my girlfriend — to track the things we want to do, get, visit, and handle together. Replaces the scattered conversations across WhatsApp, screenshots, mental notes, and "remind me about that thing" texts that currently hold our shared planning. The point is that both of us can add to it, see what the other has added, react to ideas, and not lose track of stuff that mattered.

This is the first multi-user module in the system. Building it requires forward-auth wiring to be complete (see prerequisites in the build prompt).

## 2. Scope

**In scope:**
- Five sections, each with its own data model: checklists, wishlists, places, activity feed, and search.
- Two-user system (just us). No per-user privacy — everything is shared.
- Reactions ("I want this too" / "I want to go too") on wishlist items and places.
- Comments on items in any section.
- Pin-to-top per section.
- Quick-add via URL paste (OpenGraph scraping for wishlists, Google Maps URLs for places).
- Module-wide search across all sections.
- Activity feed showing recent actions by either of us.
- Section-specific archival behavior.
- Dashboard widget.

**Out of scope (deferred to v0.2 or later):**
- **Plans section** — umbrella feature aggregating wishlist items, places, and checklists under a named project (e.g., "Trip to Zanzibar"). Defer until it's clear we actually want an umbrella rather than just using the sections independently.
- Cross-references in comments/notes (`#wishlist/camera` style auto-linking).
- Recurring checklists (v0.1 ships with a "duplicate checklist" button as a stand-in).
- Export to Markdown / text.
- Reminders — handled by future calendar/tasks modules if/when they exist.
- Private/surprise items — contradicts the module's point.
- Native mobile features (location detection, camera attachment, etc.) — PWA basics only.
- More than two users.

## 3. User Stories

- As me, I open `us` on my phone and see what my girlfriend added today across all sections.
- As me, I paste a product URL into the wishlist; the backend scrapes the image and title, item appears.
- As my girlfriend, I see the camera he added, tap "I want this too," and it shows as `mutual` in both our views.
- As me, I add a comment to a place: "we should check if they take reservations." She sees the comment next time she opens that place.
- As us, we keep an "Apartment Chores" checklist. When the place is sparkling, I archive it. We start a new one for next month.
- As me, I search "camera" in the module header and see the wishlist item, the comment about it, and a place we added called "Camera House."
- As us, we mark a restaurant as `visited` after going there, rate it 4 stars, leave notes about what we ate.
- As me, I pin "Apartment hunt checklist" to the top of the checklists section because it's what we're actively working on; the 30 archived shopping lists below don't clutter the view.

## 4. The Module Manifest

```yaml
id: us
name: Us
description: Shared lists, plans, and places for the two of us
icon: heart
type: proxy_subpath
url: /us
internal_api: http://us:3000/us/api
health_check: http://us:3000/us/api/health
widgets:
  - id: recent
    endpoint: /widget/recent
    refresh_seconds: 600
events:
  publishes: []
  subscribes: []
```

No events published or subscribed in v0.1. The module is self-contained — multi-user shared state but no cross-module coupling.

## 5. Public API

All endpoints under `http://us:3000/us/api`. UI routes served at `/us/*` via Caddy. All endpoints require an authenticated user (forward-auth must inject `Remote-Email`).

### Checklists

- `GET /api/checklists?archived={true|false}` — list checklists, default unarchived only.
- `POST /api/checklists` — create. Body: `{ name, description? }`.
- `GET /api/checklists/:id` — full checklist with items.
- `PATCH /api/checklists/:id` — update name/description/pinned/archived.
- `DELETE /api/checklists/:id` — delete (hard delete; archival is the soft option).
- `POST /api/checklists/:id/duplicate` — clone the checklist with all items reset to incomplete.
- `POST /api/checklists/:id/items` — add item. Body: `{ text, dueDate?, notes? }`.
- `PATCH /api/checklists/:id/items/:itemId` — update item (text, completed, dueDate, notes).
- `DELETE /api/checklists/:id/items/:itemId` — delete item.
- `POST /api/checklists/:id/items/:itemId/reorder` — Body: `{ position }`. Integer position.

### Wishlists

- `GET /api/wishlist?status={wanted|bought|received|passed|all}` — flat list of all wishlist items, filtered by status (default `wanted`).
- `POST /api/wishlist` — add item. Body: `{ title, description?, url?, imageUrl?, price?, currency?, category? }`. If only `url` provided, backend scrapes OpenGraph to fill the rest before responding.
- `POST /api/wishlist/quick-add` — Body: `{ url }`. Convenience endpoint: scrape OpenGraph, create item with defaults, return created item. Used by the paste-to-add flow.
- `GET /api/wishlist/:id` — single item with reactions and comments.
- `PATCH /api/wishlist/:id` — update item or change status.
- `DELETE /api/wishlist/:id` — delete.
- `POST /api/wishlist/:id/react` — add `+1` reaction. Body empty. Idempotent (same user reacting twice has no effect). Implicit user from auth headers.
- `DELETE /api/wishlist/:id/react` — remove your `+1`.

### Places

- `GET /api/places?status={wantToGo|visited|passed|all}&category=...` — list places.
- `POST /api/places` — add. Body: `{ name, location?, description?, url?, imageUrl?, category? }`. If `url` looks like a Google Maps URL, attempt to parse name and location.
- `POST /api/places/quick-add` — Body: `{ url }`. Same pattern as wishlist quick-add.
- `GET /api/places/:id` — single place with reactions, comments, and visit log.
- `PATCH /api/places/:id` — update. Marking as `visited` triggers visit log entry.
- `DELETE /api/places/:id` — delete.
- `POST /api/places/:id/react` — `+1`. Same semantics as wishlist.
- `DELETE /api/places/:id/react` — remove.
- `POST /api/places/:id/visits` — log a visit. Body: `{ visitedAt?, rating?, notes? }`. Each visit is a separate row (you can visit the same place multiple times).

### Comments (cross-section)

Comments attach to any item across sections. The item is identified by `(itemType, itemId)`:

- `POST /api/comments` — Body: `{ itemType, itemId, body }`. `itemType` ∈ `{checklist-item, wishlist, place}`.
- `GET /api/comments?itemType=...&itemId=...` — list comments for an item, chronological.
- `PATCH /api/comments/:id` — edit own comment. Other user's comments not editable.
- `DELETE /api/comments/:id` — delete own comment.

### Activity feed

- `GET /api/activity?since={iso8601}&limit={int}` — recent activity. Default last 30 days, max 100 entries.
  - Returns `{ entries: [{ id, kind, actor, itemType, itemId, itemTitle, section, ts, meta? }] }`.
  - `kind` ∈ `{added, status-changed, reacted, plan-status-changed, note-added, completed}`.
  - Burst-coalesced: same actor + same kind + same section within 10 minutes collapse to one entry with `meta.count`.

### Search

- `GET /api/search?q={query}` — search across checklists, wishlist items, places, and comments.
  - Returns grouped results: `{ checklists: [...], checklistItems: [...], wishlist: [...], places: [...], comments: [...] }`.
  - Postgres full-text search (`tsvector`/`tsquery`) on item titles + descriptions + comment bodies.
  - v0.1 ships with English search config; revisit if needed.

### Widget

- `GET /widget/recent` — dashboard widget.
  - **Auth:** service token (`aud == us`).
  - **Response:**
    ```json
    {
      "title": "Us",
      "primary": "5 items this week",
      "secondary": "Jane added Camera to Wishlist",
      "link": "/us"
    }
    ```
  - **Primary:** count of activity-feed entries from the past 7 days.
  - **Secondary:** most recent entry, in past tense.
  - **Empty state:** `primary: "Nothing yet"`, no secondary.

## 6. Events

None in v0.1. The module is self-contained.

If future modules want to react to `us` activity (e.g., notifications module surfacing new wishlist items), v0.2 can add `us.item.added` and `us.item.reacted` as pubsub events. Defer until concrete subscriber exists.

## 7. Widgets

### `recent`

- **What it shows:** count of recent activity + the latest entry.
- **Refresh:** 600s.
- See API spec above.

## 8. Data Ownership

Schema: `us` (Postgres). Module DB user: `us`.

```
us.checklists
  id            uuidv7       PRIMARY KEY
  name          text         NOT NULL
  description   text
  is_pinned     boolean      NOT NULL DEFAULT false
  is_archived   boolean      NOT NULL DEFAULT false
  archived_at   timestamptz
  created_by    text         NOT NULL  -- user email
  created_at    timestamptz  NOT NULL DEFAULT NOW()
  updated_at    timestamptz  NOT NULL DEFAULT NOW()

us.checklist_items
  id            uuidv7       PRIMARY KEY
  checklist_id  uuidv7       NOT NULL REFERENCES us.checklists(id) ON DELETE CASCADE
  text          text         NOT NULL
  notes         text
  due_date      date
  position      integer      NOT NULL DEFAULT 0
  completed     boolean      NOT NULL DEFAULT false
  completed_at  timestamptz
  completed_by  text
  added_by      text         NOT NULL
  created_at    timestamptz  NOT NULL DEFAULT NOW()

us.wishlist_items
  id            uuidv7       PRIMARY KEY
  title         text         NOT NULL
  description   text
  url           text
  image_url     text
  price         numeric(12,2)
  currency      text         -- from user's preference or scraped data
  category      text
  status        text         NOT NULL DEFAULT 'wanted'
                             CHECK (status IN ('wanted','bought','received','passed'))
  is_pinned     boolean      NOT NULL DEFAULT false
  added_by      text         NOT NULL
  status_changed_by text
  status_changed_at timestamptz
  created_at    timestamptz  NOT NULL DEFAULT NOW()
  updated_at    timestamptz  NOT NULL DEFAULT NOW()

us.places
  id            uuidv7       PRIMARY KEY
  name          text         NOT NULL
  location      text         -- free-text for v0.1
  description   text
  url           text
  image_url     text
  category      text         CHECK (category IS NULL OR category IN
                             ('restaurant','bar','activity','landmark','nature','other'))
  status        text         NOT NULL DEFAULT 'wantToGo'
                             CHECK (status IN ('wantToGo','visited','passed'))
  is_pinned     boolean      NOT NULL DEFAULT false
  added_by      text         NOT NULL
  created_at    timestamptz  NOT NULL DEFAULT NOW()
  updated_at    timestamptz  NOT NULL DEFAULT NOW()

us.place_visits
  id            uuidv7       PRIMARY KEY
  place_id      uuidv7       NOT NULL REFERENCES us.places(id) ON DELETE CASCADE
  visited_at    timestamptz  NOT NULL DEFAULT NOW()
  rating        integer      CHECK (rating IS NULL OR rating BETWEEN 1 AND 5)
  notes         text
  logged_by     text         NOT NULL
  created_at    timestamptz  NOT NULL DEFAULT NOW()

us.reactions
  id            uuidv7       PRIMARY KEY
  item_type     text         NOT NULL CHECK (item_type IN ('wishlist','place'))
  item_id       uuidv7       NOT NULL
  reactor       text         NOT NULL  -- user email
  created_at    timestamptz  NOT NULL DEFAULT NOW()
  UNIQUE (item_type, item_id, reactor)
  -- v0.1: only one reaction type (+1). Add `reaction_type` column if more land later.

us.comments
  id            uuidv7       PRIMARY KEY
  item_type     text         NOT NULL CHECK (item_type IN ('checklist-item','wishlist','place'))
  item_id       uuidv7       NOT NULL
  body          text         NOT NULL
  author        text         NOT NULL
  created_at    timestamptz  NOT NULL DEFAULT NOW()
  updated_at    timestamptz  NOT NULL DEFAULT NOW()

us.activity
  id            uuidv7       PRIMARY KEY
  kind          text         NOT NULL
                             -- one of: added, status-changed, reacted, completed, commented, visited
  section       text         NOT NULL  -- checklist | wishlist | places
  actor         text         NOT NULL  -- user email
  item_type     text
  item_id       uuidv7
  item_title    text         -- denormalized for activity-feed display without joins
  meta          jsonb        -- e.g., { newStatus: 'bought', oldStatus: 'wanted' }
  created_at    timestamptz  NOT NULL DEFAULT NOW()

-- Indexes:
-- us.activity(created_at DESC)
-- us.reactions(item_type, item_id)
-- us.comments(item_type, item_id, created_at)
-- us.wishlist_items(status, is_pinned, created_at DESC)
-- us.places(status, is_pinned, created_at DESC)
-- us.checklist_items(checklist_id, position)

-- Full-text search:
-- generated `tsvector` columns on wishlist_items(title, description),
-- places(name, description), comments(body), checklist_items(text, notes)
-- GIN indexes on each tsvector.
```

Activity logging happens via Postgres triggers OR application-level inserts (pick one, document the decision). Triggers are more reliable; application inserts are more flexible. Recommend application-level for v0.1 — easier to coalesce bursts in code than in SQL.

## 9. External Dependencies

- **OpenGraph scraping** for wishlist quick-add. Use a small library (e.g., `open-graph-scraper` on npm) or roll a thin fetcher. Fetch `<meta property="og:*">` tags from the URL. If scraping fails, return the URL as the title and let the user fill in the rest.
- **Google Maps URL parsing** for place quick-add. Parse the URL to extract `place_id` or `q=` parameter for the name; resolve the location via the unfurled URL or just keep it as the user-provided string. Don't call any Google API (cost, complexity) — pure URL parsing for v0.1.

If scraping is down or slow, the quick-add endpoint times out at 3s and returns the item with whatever data is available. User can edit afterward.

## 10. Internal Architecture

TypeScript + Next.js (App Router), served at `/us`. Same stack as meals and pantry. Drizzle ORM for Postgres.

Module-wide navigation: top bar with section tabs (Checklists / Wishlists / Places / Activity / Search) and the Center's shared chrome shim already injected.

Single container: `us`.

**root_path:** Next.js `basePath: "/us"` in `next.config.ts`. Caddy routes `/us*` to `us:3000` without prefix stripping (consistent with meals and pantry pattern).

**Activity coalescing:** when inserting an activity row, check for an existing row in the last 10 minutes matching `(actor, kind, section, item_type, item_id)`. If found, increment `meta.count` on the existing row rather than inserting a new one. This is an application-level concern, not DB.

**Multi-user identity:** every endpoint reads `Remote-Email` from request headers (injected by Caddy forward-auth → Pocket-ID). Falls back to `US_DEFAULT_USER` env var only in development (logs a warning in production). The user identity is propagated to `added_by`, `created_by`, `actor`, etc., on every write.

## 11. Failure Modes & Degradation

- **Forward-auth headers missing in production:** module returns 401 on all write endpoints. Read endpoints return public data (since everything is shared between the two users, there's no privacy to enforce). Logs a critical warning. This shouldn't happen — Caddy must enforce auth before requests reach the module.
- **OpenGraph scraping fails / times out:** quick-add returns the item with `title = url`, no image, no description. User edits to fill in. UI shows a "couldn't fetch metadata" notice.
- **Center registry unreachable:** affects service-token validation for incoming widget poll. Module UI unaffected. Widget endpoint returns 503 to Center; widget shows stale or empty state.
- **Postgres down:** crash + restart. Acceptable.
- **Redis down:** N/A — module doesn't use Redis (no events).

## 12. Open Questions

1. **Categories for wishlist** — free-text or enum? v0.1 uses free-text. Revisit if categorization becomes important.
2. **Image storage** — currently we store the image URL (pointing to wherever the OpenGraph scrape pointed). If the source site removes the image, our wishlist breaks. Acceptable for v0.1; revisit if it's annoying. v0.2 could proxy/cache images.
3. **Coalescing window** — 10 minutes might be too tight or too loose. Adjust based on real usage.
4. **Soft-delete vs hard-delete** — v0.1 hard-deletes items (and the activity log retains the title). If you want "undo delete," add a `deleted_at` column in v0.2.
5. **Reaction notifications** — when one of us reacts, should the other get a real-time signal beyond the activity feed? v0.1: no, activity feed is enough. Revisit if it feels missing.
