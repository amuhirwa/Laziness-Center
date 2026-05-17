# STATUS — Laziness Center

> Living progress log. Updated by Claude Code at the end of every meaningful session.

**Last updated:** 2026-05-17
**Updated by:** Claude Code — Phase 7 implementation

---

## Current Phase

**Phase 7 — Polish (code complete, pending first deploy)**

All phases through 7 are written. Nothing deployed yet. Deploy is the immediate next step.

## Last Session Summary (Phase 7 + housekeeping)

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

**Infrastructure:** docker-compose (7 services), Caddyfile (TLS, per-module routing), Postgres init (4 schemas), `.env.example`.

**Center:** Auth, dashboard (widgets + ordering), launcher, admin registry, internal API (service discovery, JWT minting, JWKS), demo widget routes.

**SDK (`packages/sdk-ts/`) v0.2:**
- `call`, `verifyServiceToken`, `verifyToken`: service-to-service HTTP with token caching.
- `publish`: pubsub (`PUBLISH`) or stream (`XADD`) based on `transport` option.
- `subscribe` + `startSubscriptions`: pubsub (`SUBSCRIBE`) or stream consumer group (`XREADGROUP`, `XACK`, DLQ after 5 failures).
- `LCError` with `kind` enum.

**Manhwa module (`modules/manhwa/`):** Python FastAPI, scraper, catalog, reading list, widget, service-token auth.

**Pantry module (`modules/pantry/`):**
- Inventory view + manual edit.
- Purchase log form: publishes `pantry.purchase.recorded` (stream) + `pantry.inventory.changed` (pubsub).
- `/api/check`: ingredient availability by normalized name.
- `/api/price-check`: most-recent unit price, metric unit conversion only.
- Stream consumer for `meals.recipe.cooked`: auto-deducts with idempotency, logs partial deductions.
- Dashboard widget: inventory count + last-updated date.

**Meals module (`modules/meals/`):**
- Suggestions page: weighted-random algorithm (pinned ×3, pantry ×2/1.5, rating × rating/3, recent-cook exclusion).
- Recipe library with filters.
- Recipe detail: servings scaler, pantry availability dots, estimated cost, step list.
- URL import: schema.org JSON-LD parser, handles HowToStep/string/blob shapes.
- Add recipe form: structured steps, ingredients with quantity/unit, meal types, tags.
- Cook mode: timed session, step-by-step, rating + notes on finish, resume from any device, cancel.
- On finish: publishes `meals.recipe.cooked` (stream) with scaled ingredient quantities.
- Pantry cache invalidation: subscribes to `pantry.inventory.changed` (pubsub).
- Dashboard widget: top suggestion for tonight.

## What's In Progress

- **First deploy** — `.env.example` → `.env`, fill all secrets including `MEALS_DEFAULT_USER` and `PANTRY_DB_PASSWORD`, run `docker compose up -d`.
- **Register meals and pantry modules** — paste manifests into Admin → Modules after deploy.
- **Bootstrap recipe library** — import first recipes via `/meals/recipes/import`, or add manually.

## What Changed This Session (post-Phase 5)

- **Phase 6 deferred** — `pantry.purchase.recorded → finance` integration skipped; FinGuide already imports from MoMo SMS and the integration would create duplicate transactions. `docs/center-srs.md §7` updated with deferred scope and three eventual sub-features (dashboard widgets, task surfacing, calendar contributions). Formal phased rollout declared complete — future modules follow the SRS template, not a phase plan.
- **FinGuide launcher tile** — registered as a `linked` module (launcher tile only, no widgets/events yet). Fill in the actual URL when pasting the manifest into Admin → Modules.
- **Currency cleanup** — all hardcoded `"USD"` defaults changed to `"RWF"` across pantry and meals modules. Pantry `instrumentation.ts` now runs `ALTER TABLE purchases ALTER COLUMN currency SET DEFAULT 'RWF'` and `UPDATE purchases SET currency = 'RWF' WHERE currency = 'USD'` on every startup (idempotent). Meal cost display switched to `Intl.NumberFormat` with the currency from the data. `DEFAULT_CURRENCY=RWF` added to `.env.example`. Integration-patterns.md updated with currency handling rules (pattern #10-13).
- **Navigation proposal** — Option C (JS shim at `/chrome/topbar.js`) proposed. Pending sign-off before implementation. See navigation section at end of STATUS.

## Open Questions for the User

1. **Hairpin NAT** — if VPS can't resolve `auth.lazy.lovey.tv` from within Docker, add `extra_hosts` to the center service.
2. **MU CSS selector** — manhwa scraper uses a CSS module class that may change on MU frontend rebuild.
3. **Navigation sign-off** — see the proposal below; confirm Option C and the shim code before it's built.
4. **FinGuide URL** — the manifest has a placeholder URL; fill in the real one when registering.

## Shared top bar — built

- `center/public/chrome/topbar.js` — static JS shim. Fetches `/api/chrome/modules`, caches in `sessionStorage` for the browser session, injects 44px fixed bar: "LC" home link + scrollable module link list. Active module highlighted by pathname prefix. Adds `padding-top: 44px` to body.
- `center/app/api/chrome/modules/route.ts` — public endpoint, no auth, 60s `Cache-Control`. Returns `{ modules: [{ id, name, url }] }` for enabled non-linked modules.
- `modules/meals/app/layout.tsx`, `modules/pantry/app/layout.tsx` — `<Script src="/chrome/topbar.js" strategy="afterInteractive" />` added; redundant `← Center` links removed.
- `modules/manhwa/templates/base.html` — `<script src="/chrome/topbar.js" defer>` added; `← Center` link removed.

## Recent Decisions

- **D25:** SDK v0.2 — streams implemented in Phase 5 (first stream use case). Consumer group name = subscribing module ID. DLQ after 5 failures at `lc:dlq:{moduleId}`.
- **D26:** npm workspaces (root `package.json`) — allows modules to reference `@lc/sdk` source without pre-build. Consuming modules use `transpilePackages: ["@lc/sdk"]`.
- **D27:** Next.js modules use `basePath` (not Caddy prefix-stripping) — Caddy routes `/meals*` → `meals:3000` without stripping; `basePath: "/meals"` in `next.config.ts` handles URL generation. `internal_api` in manifests must include the basePath: `http://meals:3000/meals/api`.
- **D28:** `MEALS_DEFAULT_USER` / `PANTRY_DEFAULT_USER` env vars for user identity in Phase 5 — Caddy forward-auth not yet wired to modules. Revisit in Phase 7 or when second user starts actively using meals/pantry.

## Known Issues / Tech Debt

- `meals.recipe.cooked` stream consumer in pantry starts in `instrumentation.ts` with `"$"` offset (only new messages). On first deploy, any events published before the consumer group was created are missed. Re-subscribe with offset `"0"` if you want to replay historical events.
- Suggestion cache invalidation deletes ALL cache rows on any pantry change — fine for one user, overkill if two users have different caches. Scope deletion by user in v1.1.
- Purchase form in pantry doesn't validate unit mismatch between items — user can log "flour in kg" then "flour in g" as two separate inventory rows. The normalization handles this at query time but inventory counts can diverge. UI warning planned for v0.2.
- No edit page for recipes in v0.1 UI (only Add/Import). API supports PUT. Add edit UI in Phase 7.
- `packages/sdk-ts/package.json` exports point to `src/index.ts` — requires `transpilePackages` in consumers. Third-party modules using the SDK as an installed npm package will need a pre-built dist. Build script is still present; add `"prepare": "npm run build"` if publishing.

---

## Doc Versions

| Doc | Version |
|---|---|
| `docs/center-srs.md` | 0.3 |
| `docs/sdk-design.md` | 0.2 |
| `docs/module-srs-template.md` | 0.2 |
| `docs/modules/manhwa.md` | 0.2.1 |
| `docs/modules/meals.md` | 0.2 |
| `docs/modules/pantry.md` | 0.2 |
| `docs/modules/tasks.md` | 0.1 |
| `docs/modules/finance.md` | 0.1 |
| `docs/modules/calendar.md` | 0.1 |
