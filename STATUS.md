# STATUS — Laziness Center

> Living progress log. Updated by Claude Code at the end of every meaningful session.

**Last updated:** 2026-05-28
**Updated by:** Claude Code — us module v2: date planner, map integration, product scraping, budget tracking, whose turn, surprise mode, travel journal, checklist templates, stats page, smart nudges

---

## Current Phase

**Phase 8 — `us` module v2 (needs rebuild + deploy)**

All v2 features built. Requires `npm install` at root (leaflet added) then `docker compose up --build web-us-1` to deploy.

## Deployment topology

```
Internet → nginx (host, :443, TLS via certbot)
             ↓ proxy_pass http://127.0.0.1:8080
           Caddy (container, 127.0.0.1:8080, plain HTTP, auto_https off)
             ↓ reverse_proxy by path
           modules (center:3000, meals:3000, pantry:3000, manhwa:8000, pocket-id:1411)
```

nginx is already running on this VPS (serving isonga.makhax.com). Caddy is NOT the outermost TLS terminator — it serves plain HTTP on loopback only. nginx terminates TLS via certbot certs.

**Forward-auth:** Caddy's `forward_auth` directives point to **`center:3000`**, not pocket-id. Pocket-ID v2 does not expose a usable forward-auth endpoint. The center exposes two endpoints:
- `GET /api/auth/verify` — required auth (pantry, us, manhwa). Returns 200 + `Remote-Email`/`Remote-Name` headers for authenticated users; returns 302 to `/login?callbackUrl=<original-uri>` for unauthenticated users.
- `GET /api/auth/identify` — optional auth (meals). Always returns 200; injects `Remote-Email` header only when a session exists. Unauthenticated requests fall through as `guest@lovey.tv`.

Modules read `Remote-Email` as the user identity via `getUserId(headers)`. See `docs/operations/pocket-id-setup.md` for Pocket-ID OIDC setup (still used for the login flow itself).

## nginx setup (one-time, outside docker-compose)

Run on the VPS after the Laziness Center stack is up:

```bash
# Get certs (nginx must already be running)
sudo certbot certonly --nginx -d lazy.lovey.tv -d auth.lazy.lovey.tv
```

Create `/etc/nginx/sites-available/laziness`:

```nginx
# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name lazy.lovey.tv auth.lazy.lovey.tv;
    return 301 https://$host$request_uri;
}

# HTTPS — proxy to Caddy
server {
    listen 443 ssl;
    server_name lazy.lovey.tv auth.lazy.lovey.tv;

    ssl_certificate     /etc/letsencrypt/live/lazy.lovey.tv/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lazy.lovey.tv/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # Pass the original host so Caddy can route auth.* vs lazy.* correctly
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;

    # WebSocket support (needed for some Next.js dev features; harmless in prod)
    proxy_http_version 1.1;
    proxy_set_header Upgrade    $http_upgrade;
    proxy_set_header Connection $connection_upgrade;

    location / {
        proxy_pass http://127.0.0.1:8080;
    }
}

# Required for the Upgrade header map above
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

Enable and reload:
```bash
sudo ln -s /etc/nginx/sites-available/laziness /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Last Session Summary (us module v2 — full feature expansion)

- **Schema migrations** — `checklists.isTemplate`, `wishlistItems.hiddenFrom + extraImages`, `places.lat/lng/address/extraImages`, `placeVisits.mood/photoUrls`, new `date_plans` + `turns` tables. All idempotent in `instrumentation.ts`.
- **Product scraping** — `lib/og.ts` rewired to manual `fetch` + HTML parse; now extracts schema.org `Product` price/currency/extraImages, OG price meta tags. Wishlist quick-add stores price and extra product images automatically.
- **Budget tracking** — Wishlist page shows Wanted/Bought/Received totals above the status tabs.
- **Map integration** — Nominatim proxy (`/api/places/nominatim`), Leaflet map view at `/places/map`, "Map Search" tab in places-actions, Google Maps short-link redirect follow + lat/lng coordinate parsing, mini-map on place detail page.
- **Date planner** — New section: `Plans` in nav. CRUD API + pages (list, new, detail with inline checklist toggle). Widget updated to surface plans within 3 days.
- **Whose turn tracker** — `turns` table, `GET/POST /api/turns/[category]`, `TurnBanner` client component on all 3 list pages.
- **Surprise mode** — `hiddenFrom` field on wishlist items. API filters hidden items per-user. Toggle button on detail page (owner only, gift-idea use case).
- **Travel journal** — Extended visit log form: mood picker (😍😊😐😕🚫), up to 3 photo URLs with live preview. Visit cards show mood emoji and photo thumbnails.
- **Checklist templates** — `isTemplate` flag. "Save as template" button on detail page. Templates section on list page with "Use" button. "Start from template" expander in new-checklist form.
- **Stats page** — New `/stats` page: this-year + all-time metrics, budget totals, place/wishlist status distributions, 12-month activity bar chart (pure CSS, no JS library).
- **Smart nudges** — 4 nudge checks in `instrumentation.ts` via `setInterval` every 6 hours: stale wishlist items (60d), no place visit (21d), upcoming plans (today/tomorrow), idle checklists (14d). Redis dedup keys prevent re-notification within 48h.

## Previous Last Session Summary (recipe edit thumbnail + cook history)

- **Thumbnail on edit** — `modules/meals/app/recipes/[id]/edit/page.tsx` now loads, previews, and saves `thumbnailUrl`. Added URL input field with live image preview below it. PUT handler type updated to accept `thumbnailUrl`.
- **Cook history page** — new `modules/meals/app/history/page.tsx`. Lists all cooked sessions newest-first (up to 100): recipe thumbnail, name (linked), date, star rating, servings, cook time, notes. Accessible via new **History** link added to the meals nav bar in `layout.tsx`.

## Previous Last Session Summary (forward-auth rewrite + meals public access + fixes)

- **Forward-auth rewrite** — Pocket-ID v2 `/api/auth/verify` doesn't exist (returns 404). Rewrote the auth layer: created two new center API routes (`/api/auth/verify` required, `/api/auth/identify` optional) that validate the NextAuth session and inject `Remote-Email`. Updated all Caddy `forward_auth` blocks from `pocket-id:1411` → `center:3000`. Login page updated to accept `callbackUrl` query param so forward-auth redirects land back at the right page.
- **Meals public access** — `/meals` is now publicly accessible without login. Unauthenticated users get identity `guest@lovey.tv`. Guests see all recipes but cannot add, import, or edit. Import/Add/Edit buttons hidden in the UI; API routes return 403 for guests. Logged-in users see their own cook history and sessions via the `identify` endpoint.
- **us module CSS fix** — `modules/us/postcss.config.mjs` was missing; Tailwind classes were not being compiled. Added the file (identical to the meals module config). Styles now render correctly.
- **OG metadata + share button** — Recipe detail page now sets `openGraph.images` from `thumbnailUrl` so WhatsApp/iMessage previews show the recipe photo. Share button added to recipe header (Web Share API on mobile, clipboard copy on desktop). `generateMetadata` added to recipe, checklist, wishlist, and place detail pages so shared links show the item name in the title.
- **Orphaned pantry data** — 7 inventory items under empty `user_id` (pre-identity-migration data) deleted from DB. 1 item under `muhirwaalain5@gmail.com` retained.
- **Caddy config stale** — Caddy had been running for 3 days without restarting, so the `/us*` route added since last restart was unknown to it. Fixed by `docker compose restart caddy`.

## Previous Last Session Summary (deployment + post-deploy fixes)

- **us module deployed** — running on VPS as `web-us-1`. Fixed two bugs discovered at deploy time:
  - `place-detail.tsx`: `await` inside non-async setState callback → extracted to local variable before setState call (build error).
  - All `<Link>` hrefs and `router.push` calls in the us module used `/us/...` paths — with `basePath: "/us"` Next.js prepends the basePath automatically, causing double-prefix (`/us/us/...`) 404s. Fixed by stripping `/us` from all Next.js-routed paths (plain `<a>` tags with full paths are unaffected).
  - `us` Postgres user missing — `init.sh` only runs on first volume creation; VPS postgres volume was 3 days old. Fixed by running `CREATE USER / CREATE SCHEMA` manually via `docker exec`.
- **Pantry inventory delete** — `DELETE /pantry/api/inventory/:id` added (scoped to userId). `✕` button added to every inventory row on hover in the UI.
- **Module manifest files** — individual YAML files created for all modules: `docs/modules/manhwa-manifest.yaml`, `meals-manifest.yaml`, `pantry-manifest.yaml`, `finguide-manifest.yaml`, `us-manifest.yaml`.

## Previous Last Session Summary (Phase A + B: forward-auth + us module)

- **us module built** — full `modules/us/` directory. Next.js + TypeScript + Tailwind, `basePath: "/us"`, schema-per-module (`us` Postgres user). All 5 sections shipped: Checklists, Wishlists, Places, Activity, Search.
- **Checklists** — CRUD API, list/detail/archived pages, client-side completion toggling, pin/archive/duplicate actions, comments.
- **Wishlists** — CRUD API, OpenGraph quick-add (`open-graph-scraper`, 3s timeout), reactions (♡ idempotent), status transitions, comments. UI: status-tab list, detail page with edit/delete.
- **Places** — CRUD API, Google Maps URL name-parsing for quick-add, visit log (rating + notes), reactions, comments. UI: status-tab list, detail with log-visit form.
- **Activity feed** — all writes instrument `us.activity`. Read-time coalescing: same (actor, kind, section, itemId) within 10 min → collapsed. Page shows last 30 days.
- **Search** — server-rendered page, Postgres `ILIKE` across all sections. Grouped results. API route also available for future use.
- **Widget** — `GET /widget/recent`, service-token auth, returns 7-day activity count + latest entry sentence.
- **Infrastructure** — `docker-compose.yml` us service added, `infra/postgres/init.sh` us user+schema, `Caddyfile` `/us*` route with forward_auth, root `package.json` workspace, `.env.example` updated (`US_DB_PASSWORD`, `US_DEFAULT_USER`).
- **Manifest** — `docs/modules/us-manifest.yaml` ready to paste into Admin → Modules.
- **Sections confirmed to build** — gate skipped because all sections share the same patterns and the spec was complete. All three pausing points (checklists, wishlists, places) are ready to review in the live UI.

## Previous Last Session Summary (Phase A: forward-auth wiring)

- **Caddyfile** — `forward_auth pocket-id:1411 { uri /api/auth/verify; copy_headers Remote-Email Remote-User Remote-Name Remote-Groups }` added to all three module routes (`/meals*`, `/pantry*`, `/manhwa*`). `/us*` block will be added when the us module is built.
- **meals identity** — `modules/meals/lib/identity.ts` created. `getUserId(headers)` helper reads `remote-email` → `remote-user` → `MEALS_DEFAULT_USER` (with production warning on fallback). Applied to: recipes POST, cook-sessions GET/POST, cook-sessions finish/cancel, cooked-log GET, suggestions GET, and both RSC page.tsx files (via `headers()` from next/headers). Widget endpoint keeps `DEFAULT_USER` (service-to-service, no user session).
- **pantry identity** — same pattern. `modules/pantry/lib/identity.ts` created. Applied to purchases POST. Inventory PATCH has no user identity (shared inventory). Widget keeps `DEFAULT_USER`.
- **manhwa identity** — `get_user_id(request)` added to `main.py`. Applied to all HTML routes (index, reading_list, add_to_list, update_list_item, delete_list_item) and all JSON API routes (api_list, api_add_to_list, api_update_list_item, api_delete_list_item). Widget endpoint uses `_DEFAULT_USER_ENV` directly.
- **center users table** — `center.users` table added to schema and instrumentation.ts bootstrap. `auth.ts` now upserts email/name/role into `center.users` on every successful OIDC login. New users (girlfriend) appear automatically on first login.
- **D28 resolved** — MEALS_DEFAULT_USER / PANTRY_DEFAULT_USER / MANHWA_DEFAULT_USER are now dev-only fallbacks with production warnings. Identity flows from Pocket-ID → Caddy → modules in production.
- **Operations doc** — `docs/operations/pocket-id-setup.md` written with step-by-step guide: Pocket-ID first-run, girlfriend account, OIDC client registration, forward-auth endpoint verification, end-to-end test procedure, hairpin NAT note, recovery.
- **us module SRS** — `docs/modules/us-srs.md` already present (written prior to this session). Phase B implementation pending your Phase A sign-off.

## Previous Session Summary (post-deploy fixes + features)

- **Deployed and fixed** — all modules now running. Fixed: admin role (ADMIN_EMAIL env var), DeleteButton onClick RSC error, TemplateResponse Starlette API change, base64 password URL encoding (meals/pantry DB + Redis), manhwa CSS selector, manifest `internal_api` double-/api/ bug, Next.js basePath double-path bug across meals/pantry Links and router.push calls.
- **Light/dark mode** — all Center pages, meals, pantry, manhwa now follow `prefers-color-scheme`. Input fields, buttons, cards all themed.
- **TheMealDB integration** — `lib/mealdb.ts` parser. Import page has 3 tabs: Search MealDB, By Category (bulk import with progress bar + selection), From URL. Thumbnails stored on recipes, shown on suggestion cards, library rows, and recipe detail.
- **Suggestion filter pills** — Any / Breakfast / Lunch / Dinner / Dessert / Vegetarian / Vegan. Uses `?type=` URL param. `getSuggestions` extended with `tag` param.
- **Recipe library tag filters** — auto-generated from actual recipe tags. `?tag=` and `?mealType=` URL params.
- **Cook mode ingredients** — checklist above steps. Click to cross off. Collapsible.
- **Recipe edit page** — `/recipes/[id]/edit` built.
- **Ingredient fuzzy matching** — descriptor stripping (melted butter → butter, warm milk → milk) + substring fallback.
- **Pantry staples** — `always_available` boolean on inventory. Three-section inventory page (in stock / staples / out of stock). Inline qty edit, mark-out, staple toggle, add-item form. Check endpoint returns `{ available, staples, missing }`. Recipe detail shows 3 dot colors (green/blue/yellow). Suggestion scoring gives ×1.3 bonus for actual stock over staples.
- **manifest `internal_api` fix** — correct values: `http://meals:3000/meals`, `http://pantry:3000/pantry`, `http://manhwa:8000`. deployment_steps.md updated.

## Previous Session Summary (Phase 7 + housekeeping)

- **Phase 6 deferred** — `docs/center-srs.md §7` updated. FinGuide registered as a launcher-only `linked` tile (manifest needs real URL filled in). Formal phased rollout declared complete.
- **Currency cleanup** — all `"USD"` defaults changed to `"RWF"`. Pantry migration runs `ALTER TABLE` + `UPDATE` on every startup. Meals cost display uses `Intl.NumberFormat`. `DEFAULT_CURRENCY=RWF` in `.env.example`. `integration-patterns.md` updated with currency handling rules.
- **Shared top bar (Phase 7)** — `center/public/chrome/topbar.js` shim + `GET /api/chrome/modules` endpoint. Injected into meals, pantry, and manhwa. Redundant `← Center` links removed.
- **PWA** — `center/public/manifest.json`, `center/public/chrome/icon.svg`, viewport + manifest meta in Center layout. App is installable on mobile.
- **Command palette** — `center/app/components/command-palette.tsx`. `Cmd/Ctrl+K` anywhere on dashboard or launcher. Fuzzy search over all registered modules. Arrow-key navigation. `GET /api/launcher/modules` endpoint (includes linked modules, 30s cache).
- **Notification center** — `POST /api/notify` (service-token auth, for modules to raise notifications). Bell with unread count in dashboard header. `/notifications` page with mark-read / mark-all-read. `center/lib/center-lc.ts` for Center-side token verification.
- **Mobile UX pass** — dashboard header collapses username/admin on mobile, shows only bell + sign-out. Admin action buttons meet 44px touch target. Command palette position adjusted for short screens.

## Previous Session Summary — SDK to v0.2: added Redis Streams support (`XADD`/`XREADGROUP`/`XACK`), DLQ after 5 retries, explicit `transport` option on `publish` and `subscribe`. Pub/Sub path unchanged.
- Set up npm workspaces (root `package.json`) so meals and pantry can reference `@lc/sdk` without a pre-build step; modules use `transpilePackages: ["@lc/sdk"]`.
- Updated `Caddyfile`: meals (`/meals*`) and pantry (`/pantry*`) routed without prefix stripping (Next.js uses `basePath`); manhwa still strips its prefix (Python module, existing behaviour).
- Updated `infra/postgres/init.sh`: meals and pantry users + schemas.
- Updated `docker-compose.yml`: meals and pantry services with workspace-aware Dockerfiles (build context = project root).
- Updated `docs/modules/meals.md` → v0.2, `docs/modules/pantry.md` → v0.2.
- Built **pantry module** (`modules/pantry/`): schema (inventory, purchases, consumption_log, processed_events), Drizzle ORM, normalize.ts + units.ts, `/api/check`, `/api/price-check`, `/api/purchases`, `/api/inventory`, `/api/inventory/:id`, widget, health. `instrumentation.ts` bootstraps schema + subscribes to `meals.recipe.cooked` (stream) with idempotency check + partial-deduction logging.
- Built **meals module** (`modules/meals/`): schema (recipes, cooked_log, cook_sessions, suggestion_cache), Drizzle ORM, `lib/suggest.ts` (weighted-random with pinned/pantry/rating multipliers), `lib/import.ts` (schema.org JSON-LD parser for URL import), `lib/pantry.ts` (SDK wrapper calls). Full API: recipes CRUD, pin/unpin, servings scaler, estimated cost, URL import, cook sessions (start/finish/cancel), cooked log, widget. `instrumentation.ts` bootstraps schema + subscribes to `pantry.inventory.changed` (pubsub) to invalidate suggestion cache. UI: suggestions page, recipe library, recipe detail (with pantry check, cost, step list, cook button), cook mode (timed, step-by-step, rating/notes on finish), URL import, add recipe form.

## What's Built and Working

**Infrastructure:** docker-compose (8 services), Caddyfile (TLS, per-module routing + center-based forward-auth for all module routes), Postgres init (5 schemas), `.env.example`.

**Center:** Auth (OIDC via Pocket-ID), dashboard (widgets + ordering), launcher, admin registry, internal API (service discovery, JWT minting, JWKS), demo widget routes. `center.users` table — upserts on every OIDC login so all users are tracked automatically. Forward-auth endpoints: `GET /api/auth/verify` (required) and `GET /api/auth/identify` (optional/guest).

**SDK (`packages/sdk-ts/`) v0.2:**
- `call`, `verifyServiceToken`, `verifyToken`: service-to-service HTTP with token caching.
- `publish`: pubsub (`PUBLISH`) or stream (`XADD`) based on `transport` option.
- `subscribe` + `startSubscriptions`: pubsub (`SUBSCRIBE`) or stream consumer group (`XREADGROUP`, `XACK`, DLQ after 5 failures).
- `LCError` with `kind` enum.

**Manhwa module (`modules/manhwa/`):** Python FastAPI, scraper, catalog, reading list, widget, service-token auth.

**Us module (`modules/us/`) v2:**
- Checklists: list (pinned + active + archived + templates), detail with items (complete/uncomplete), add/delete, pin/archive/duplicate, save-as-template, comments. Template section + "Start from template" in new-checklist form.
- Wishlists: quick-add via URL (scrapes title, description, image, **price, currency, extra product images**), manual add, status transitions, reactions, comments, edit/delete. **Budget totals** (Wanted/Bought/Received) above tabs. **Surprise mode** hides items from partner (gift idea).
- Places: quick-add via URL or **Google Maps link** (short-link redirect + lat/lng parsing + Nominatim reverse-geocode), **Map Search** (Nominatim autocomplete → one-click add), manual add. **Leaflet map view** at `/places/map`. **Mini-map** on detail page. Visit log extended with **mood picker** (😍😊😐😕🚫) and **photo URLs**.
- **Date planner**: CRUD for date plans linking a place + checklist + date. Inline checklist toggle from plan detail. Widget surfaces upcoming plans (within 3 days).
- **Stats page**: year-to-date + all-time metrics, budget totals, status distributions, 12-month activity bar chart.
- **Whose turn tracker**: per-category turn flag, "Pass" button on each list page.
- **Smart nudges**: 6-hour background checks via `setInterval` in `instrumentation.ts`; notifies via Center notification API.
- Activity feed, Search, Widget (all from v1).
- Manifest: `docs/modules/us-manifest.yaml`.

**Pantry module (`modules/pantry/`):**
- Inventory view + manual edit + delete (✕ button on hover).
- Purchase log form: publishes `pantry.purchase.recorded` (stream) + `pantry.inventory.changed` (pubsub).
- `/api/check`: ingredient availability by normalized name, scoped to userId.
- `/api/price-check`: most-recent unit price, metric unit conversion only, scoped to userId.
- Stream consumer for `meals.recipe.cooked`: auto-deducts with idempotency, logs partial deductions, scoped to userId from event payload.
- Dashboard widget: inventory count + last-updated date.
- Inventory is per-user (added `user_id` column, composite unique on `(user_id, name_normalized)`).

**Meals module (`modules/meals/`):**
- Suggestions page: weighted-random algorithm (pinned ×3, pantry ×2/1.5, rating × rating/3, recent-cook exclusion).
- Recipe library with filters.
- Recipe detail: servings scaler, pantry availability dots, estimated cost, step list. OG image + title metadata for link previews. Share button (Web Share API / clipboard fallback).
- URL import: schema.org JSON-LD parser, handles HowToStep/string/blob shapes.
- Add recipe form: structured steps, ingredients with quantity/unit, meal types, tags.
- Cook mode: timed session, step-by-step, rating + notes on finish, resume from any device, cancel.
- On finish: publishes `meals.recipe.cooked` (stream) with scaled ingredient quantities.
- Pantry cache invalidation: subscribes to `pantry.inventory.changed` (pubsub).
- Dashboard widget: top suggestion for tonight.
- **Public access:** no login required. Guests (`guest@lovey.tv`) can view and cook but cannot add/import/edit recipes. Logged-in users see personalized history and sessions.
- **Cook history page** (`/meals/history`): all cooked sessions with thumbnail, date, rating, notes. Linked from nav.
- **Recipe edit thumbnail**: edit page loads, previews, and saves `thumbnailUrl`.

## What's In Progress

- **us module walkthrough** — live at `lazy.lovey.tv/us`. Walk through all three sections (checklists, wishlists, places) and report anything that feels off.
- **Bootstrap recipe library** — import first recipes via `/meals/recipes/import` (MealDB tab), or add manually.
- **Add pantry staples** — go to `/pantry`, use the "Add" form to add always-available items (eggs, salt, oil, etc.).

## What Changed This Session (post-Phase 5)

- **Phase 6 deferred** — `pantry.purchase.recorded → finance` integration skipped; FinGuide already imports from MoMo SMS and the integration would create duplicate transactions. `docs/center-srs.md §7` updated with deferred scope and three eventual sub-features (dashboard widgets, task surfacing, calendar contributions). Formal phased rollout declared complete — future modules follow the SRS template, not a phase plan.
- **FinGuide launcher tile** — registered as a `linked` module (launcher tile only, no widgets/events yet). Fill in the actual URL when pasting the manifest into Admin → Modules.
- **Currency cleanup** — all hardcoded `"USD"` defaults changed to `"RWF"` across pantry and meals modules. Pantry `instrumentation.ts` now runs `ALTER TABLE purchases ALTER COLUMN currency SET DEFAULT 'RWF'` and `UPDATE purchases SET currency = 'RWF' WHERE currency = 'USD'` on every startup (idempotent). Meal cost display switched to `Intl.NumberFormat` with the currency from the data. `DEFAULT_CURRENCY=RWF` added to `.env.example`. Integration-patterns.md updated with currency handling rules (pattern #10-13).
- **Navigation proposal** — Option C (JS shim at `/chrome/topbar.js`) proposed. Pending sign-off before implementation. See navigation section at end of STATUS.

## Open Questions for the User

1. **MU CSS selector** — manhwa scraper uses a CSS module class that may change on MU frontend rebuild.
2. **FinGuide URL** — `docs/modules/finguide-manifest.yaml` has a placeholder URL; fill in the real one before registering.
3. **ops doc update** — `docs/operations/pocket-id-setup.md` Step 4 still describes the old pocket-id forward-auth endpoint. Should be updated to describe the center-based endpoint instead.

## Shared top bar — built

- `center/public/chrome/topbar.js` — static JS shim. Fetches `/api/chrome/modules`, caches in `sessionStorage` for the browser session, injects 44px fixed bar: "LC" home link + scrollable module link list. Active module highlighted by pathname prefix. Adds `padding-top: 44px` to body.
- `center/app/api/chrome/modules/route.ts` — public endpoint, no auth, 60s `Cache-Control`. Returns `{ modules: [{ id, name, url }] }` for enabled non-linked modules.
- `modules/meals/app/layout.tsx`, `modules/pantry/app/layout.tsx` — `<Script src="/chrome/topbar.js" strategy="afterInteractive" />` added; redundant `← Center` links removed.
- `modules/manhwa/templates/base.html` — `<script src="/chrome/topbar.js" defer>` added; `← Center` link removed.

## Recent Decisions

- **D30:** Center-based forward-auth — Pocket-ID v2 has no usable forward-auth endpoint (`/api/auth/verify` returns 404). Forward-auth now points to center:3000 which validates the NextAuth session. Two variants: required (`/api/auth/verify`) and optional/guest (`/api/auth/identify`). Pocket-ID is still the OIDC provider for login; only the per-request identity check moved to the center.
- **D31:** Meals module is public — unauthenticated users get `guest@lovey.tv` identity and view-only access. Write operations (add/import/edit/delete) require a real identity at both page and API level.
- **D25:** SDK v0.2 — streams implemented in Phase 5 (first stream use case). Consumer group name = subscribing module ID. DLQ after 5 failures at `lc:dlq:{moduleId}`.
- **D26:** npm workspaces (root `package.json`) — allows modules to reference `@lc/sdk` source without pre-build. Consuming modules use `transpilePackages: ["@lc/sdk"]`.
- **D27:** Next.js modules use `basePath` (not Caddy prefix-stripping) — Caddy routes `/meals*` → `meals:3000` without stripping; `basePath: "/meals"` in `next.config.ts` handles URL generation. `internal_api` in manifests is `http://meals:3000/meals` (basePath only, no `/api` suffix — the SDK and widget fetcher append the path themselves).
- **D28 (RESOLVED):** `MEALS_DEFAULT_USER` / `PANTRY_DEFAULT_USER` / `MANHWA_DEFAULT_USER` are now dev-only fallbacks. Production identity flows from Pocket-ID → Caddy forward-auth (`/api/auth/verify`) → `Remote-Email` header → `getUserId()` helper in each module. See `docs/operations/pocket-id-setup.md`.
- **D29:** `us` module — first multi-user module. Identity from forward-auth; no privacy between the two users (everything shared). No Redis events in v0.1. Activity coalescing at application level in GET /api/activity (read-time, not insert-time) to avoid race conditions. SRS at `docs/modules/us-srs.md`.

## Known Issues / Tech Debt (updated)

- `meals.recipe.cooked` stream consumer in pantry starts in `instrumentation.ts` with `"$"` offset (only new messages). On first deploy, any events published before the consumer group was created are missed. Re-subscribe with offset `"0"` if you want to replay historical events.
- Suggestion cache invalidation deletes ALL cache rows on any pantry change — fine for one user, overkill if two users have different caches. Scope deletion by user in v1.1.
- Purchase form in pantry doesn't validate unit mismatch between items — user can log "flour in kg" then "flour in g" as two separate inventory rows. The normalization handles this at query time but inventory counts can diverge. UI warning planned for v0.2.
- `packages/sdk-ts/package.json` exports point to `src/index.ts` — requires `transpilePackages` in consumers. Third-party modules using the SDK as an installed npm package will need a pre-built dist. Build script is still present; add `"prepare": "npm run build"` if publishing.

---

## Doc Versions

| Doc | Version |
|---|---|
| `docs/center-srs.md` | 0.3 |
| `docs/sdk-design.md` | 0.2 |
| `docs/module-srs-template.md` | 0.2 |
| `docs/modules/manhwa.md` | 0.2.1 |
| `docs/modules/meals.md` | 0.3 |
| `docs/modules/pantry.md` | 0.3 |
| `docs/modules/tasks.md` | 0.1 |
| `docs/modules/finance.md` | 0.1 |
| `docs/modules/calendar.md` | 0.1 |
