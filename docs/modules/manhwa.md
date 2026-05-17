# Module SRS — `manhwa`

**Version:** 0.2.1
**Date:** 2026-05-17
**Module type:** `proxy_subpath`
**Status:** Confirmed — build in progress

**Changelog**
- v0.2.1 — Three corrections before build: (1) widget endpoint auth changed from "none" to service token — verified via Center's inline RS256 JWT check (pyjwt); (2) stale-while-revalidate revalidation guarded by asyncio.Lock per params_hash to prevent duplicate concurrent scrapes; (3) all three open questions resolved and closed.
- v0.2 — Split scrape_cache into titles catalog + search_results pointer table; expanded reading_list with user_id, mu_id FK, status='dropped', current_chapter, my_rating, notes, last_read_at, UNIQUE(user_id, mu_id); POST /api/list takes mu_id; pinned widget secondary text; mandated FastAPI root_path=/manhwa.
- v0.1 — Initial draft.

---

## 1. Purpose

Browse and track manhwa recommendations pulled from MangaUpdates. Surfaces a
filterable list (genre, rating, year) and lets you maintain a personal reading
list per user. The scraper is a direct evolution of the existing mangaupdates.py
script — same pagination logic, same filter params — extended with a persistent
catalog and a per-user reading list.

## 2. Scope

**In scope:** scraping MangaUpdates, title catalog, per-user reading-list CRUD,
dashboard widget.

**Out of scope:** reading actual chapters, chapter-release push notifications
(Phase 8+), cross-module recommendations, multi-source scraping (MangaUpdates
only).

## 3. User Stories

- As me, I open `/manhwa` and see a filtered list of high-rated fantasy manhwa
  from the last 5 years without waiting for a live scrape.
- As me, I click "Want to read" on a title; it moves to my reading list.
- As me, I update my status from "reading" to "completed" and add a personal rating.
- As my girlfriend, I have a completely separate reading list for the same catalog.
- As me, I see a widget on the dashboard showing my reading count and the
  highest-rated title still on my want list.
- As me, I re-run a search with different filters; existing catalog entries are
  updated, not duplicated.

## 4. The Module Manifest

```yaml
id: manhwa
name: Manhwa
description: Browse and track manhwa from MangaUpdates
icon: book-open
type: proxy_subpath
url: /manhwa
internal_api: http://manhwa:8000/api
health_check: http://manhwa:8000/health
widgets:
  - id: reading
    endpoint: /widget/reading
    refresh_seconds: 3600
```

## 5. Public API

HTML UI routes are served directly by FastAPI at the paths below (all prefixed
with `/manhwa` via Caddy). JSON endpoints are under `/manhwa/api/`.

### `GET /` (HTML — browse page)

Filter form + results list. Same params as `GET /api/search`.

### `GET /list` (HTML — reading list page)

User's reading list grouped by status.

### `POST /list/add` (HTML form handler)

Adds a title. Body: `mu_id` (hidden), `status` (select). Redirects back to browse.

### `POST /list/{id}/update` (HTML form handler)

Updates a list entry. Body: any subset of `status`, `current_chapter`,
`my_rating`, `notes`. Redirects back to reading list.

### `POST /list/{id}/delete` (HTML form handler)

Removes a list entry. Redirects back to reading list.

### `GET /api/search`

- **Purpose:** Return manhwa matching filter params. Cache TTL: 6 hours per
  params_hash. Stale cache served immediately; revalidation runs in background
  (see §10 for lock guardrail).
- **Query params:** `genres`, `excluded_genres`, `min_rating`, `start_year`
- **Response:** `{ titles: [Title], cached: bool, stale: bool, fetched_at: iso8601 }`

### `GET /api/list`

- **Response:** `{ items: [ListItem] }` — full title data joined.

### `POST /api/list`

- **Body:** `{ mu_id, status, current_chapter?, my_rating?, notes? }`
- **Behaviour:** If `mu_id` not in catalog, fetch from MU and upsert first.
  Returns `404` if MU can't resolve, `409` on duplicate.
- **Response:** `201 ListItem`

### `PATCH /api/list/{id}`

- **Body:** any subset of `{ status, current_chapter, my_rating, notes }`
- **Response:** `200 ListItem`

### `DELETE /api/list/{id}`

- **Response:** `204`

### `GET /api/widget/reading`

- **Auth:** **Service token required.** The Center mints a JWT (`iss=lc-center`,
  `aud=manhwa`) and passes it as `Authorization: Bearer`. The module verifies
  signature, `iss`, `aud == "manhwa"`, and `exp` using the Center's public key
  fetched at startup from `GET {CENTER_INTERNAL_URL}/internal/jwks`.
  Implementation: ~30 lines using `pyjwt` + `cryptography`. Reject with `401`
  on any failure.
- **Response:**
  ```json
  {
    "title": "Manhwa",
    "primary": "3 reading · 12 want",
    "secondary": "Omniscient Reader (9.1)",
    "link": "/manhwa"
  }
  ```
  `primary`: `"{reading} reading · {want} want"` scoped to `MANHWA_DEFAULT_USER`.
  `secondary`: highest `site_rating` in user's `want` list, formatted
  `"{title} ({site_rating})"`. Fallback if want list empty: highest-rated
  catalog title not on any of this user's lists.
  If `MANHWA_DEFAULT_USER` unset: `primary = "{n} in catalog"`,
  `secondary` = highest-rated catalog title.

### `GET /health`

Returns `200 { "ok": true }`.

## 6. Events

None in Phase 4.

## 7. Widgets

### `reading`

- **Refresh:** 3600s (matches manifest).
- **Primary:** `"{reading} reading · {want} want"` for default user.
- **Secondary:** highest `site_rating` title in want list →
  fallback to highest-rated catalog title not on any list →
  omit if catalog empty.
- **Empty state:** `primary: "No titles tracked"`.
- **Error state:** Center renders "Unavailable" (standard degradation).

## 8. Data Ownership

Schema: `manhwa`. DB user: `manhwa` (created by `infra/postgres/init.sh`).
Tables bootstrapped by the module's own startup migration (`db.py`).

```
manhwa.titles
  mu_id           text         PRIMARY KEY   -- stable segment from MU URL
  title           text         NOT NULL
  mu_url          text         NOT NULL
  genres          text[]       NOT NULL DEFAULT '{}'
  year            int
  site_rating     numeric(4,2)
  description     text
  cover_url       text                        -- NULL in v0.1; additive later
  last_seen_at    timestamptz  NOT NULL
  last_scraped_at timestamptz  NOT NULL

manhwa.search_results
  params_hash     text         PRIMARY KEY   -- SHA-256 of canonical sorted params
  mu_ids          text[]       NOT NULL      -- ordered result set for this search
  fetched_at      timestamptz  NOT NULL

manhwa.reading_list
  id              serial       PRIMARY KEY
  user_id         text         NOT NULL
  mu_id           text         NOT NULL      REFERENCES manhwa.titles(mu_id)
  status          text         NOT NULL      CHECK (status IN ('want','reading','completed','dropped'))
  current_chapter int
  my_rating       numeric(3,1)              -- user's 0-10; distinct from site_rating
  notes           text
  added_at        timestamptz  NOT NULL      DEFAULT NOW()
  updated_at      timestamptz  NOT NULL      DEFAULT NOW()
  last_read_at    timestamptz
  UNIQUE (user_id, mu_id)
```

## 9. External Dependencies

**MangaUpdates (mangaupdates.com)**
- Scraped via `httpx` (async) + BeautifulSoup.
- Pagination: sequential, ≤ 20 pages, same logic as original script.
- Cache: 6-hour TTL per params_hash. Stale-while-revalidate (see §10).
- Unavailable: serve stale cache with `stale: true`; empty list + error banner
  if no cache.
- Rate-limit risk: low — sequential, no parallelism.

## 10. Internal Architecture

**Stack:** Python 3.12, FastAPI, Jinja2, httpx, asyncpg, pyjwt + cryptography.
**root_path:** FastAPI app instantiated with `root_path="/manhwa"` so that
`url_for()` and static asset paths resolve correctly behind Caddy.
Verify post-deploy: view page source, confirm all hrefs begin with `/manhwa/`.

**Stale-while-revalidate lock:** a module-level
`_scrape_locks: dict[str, asyncio.Lock]` keyed by params_hash. Before starting
a scrape, check `lock.locked()` — if true, another revalidation is already in
progress and this request returns immediately. Inside the lock, double-check
the cache freshness (another concurrent request may have just updated it).
This prevents duplicate concurrent scrapes against MangaUpdates for the same
query.

**Containers:** one — `manhwa` (uvicorn, port 8000, not published externally).

**No background workers.** Scrapes are on-demand (blocking for first-load,
background fire-and-forget for stale revalidation).

## 11. Failure Modes

- **MangaUpdates down:** stale cache served with `stale: true` indicator; empty
  list + error banner if no cache. Reading list still fully functional.
- **Postgres down:** container crashes; compose restarts.
- **Center down:** module UI serves independently (no runtime Center dependency).
  Widget endpoint auth check will fail (can't fetch public key) → returns `503`.
- **mu_id not in catalog on POST /api/list:** attempt live MU fetch. If MU
  also down → `503`, do not add to list.
- **Scrape returns 0 results:** store empty `mu_ids: []`; surface "No results".

## 12. Open Questions

All three open questions from v0.2 are resolved:

1. **MU ID extraction — RESOLVED.** MangaUpdates assigns one stable mu_id per
   series (confirmed by user). URL pattern
   `https://www.mangaupdates.com/series/XXXXXXX/title-slug` is stable; the
   `XXXXXXX` segment is the canonical identifier. Schema committed: mu_id as
   natural primary key and FK target.

2. **Cover images — DEFERRED (by design).** `cover_url` column exists in schema
   (already NULL-safe). Fetching covers requires a per-title HTTP request;
   deferred to v0.2. UI shows placeholder or hides image slot. Additive, no
   migration needed later.

3. **Widget user_id when MANHWA_DEFAULT_USER unset — RESOLVED.** Show
   catalog-level stats: `primary = "{n} in catalog"`, `secondary` = highest
   site_rating title in catalog. No user-scoped data accessed.
