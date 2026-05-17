# Laziness Center — Software Requirements Specification & Architecture Plan

**Version:** 0.3
**Date:** May 2026
**Author:** You
**Scope:** The Center (shell/hub). Modules are specified separately.

**Changelog**
- v0.3 — Major refinements based on real use cases: (a) inter-module communication elevated to a v1 first-class concern (not v2) with sync HTTP for queries/commands and events for fact-broadcasts, (b) Center now owns a service-discovery + inter-module-auth role, (c) ACL dropped in favor of `default_hidden` since the only other user is fully trusted, (d) tech stack pinned: Next.js + TypeScript for the Center, polyglot for modules, (e) database model pinned: shared Postgres with schema-per-module + user-per-module, no cross-schema FKs, (f) subpaths confirmed over subdomains with rationale, (g) PWA confirmed over native shell.
- v0.2 — Three refinements: (a) split embedded module type into `iframe` vs `proxy_subpath` to make the routing model explicit, (b) clarified that module-internal infrastructure (workers, brokers, caches) is owned by the module, (c) expanded the v2 event-bus plan with manifest declarations and Pub/Sub vs Streams guidance.
- v0.1 — Initial draft.

---

## 1. Introduction

### 1.1 Purpose
The Laziness Center is a self-hosted personal webapp that serves as the unified entry point to a growing collection of personal automation tools, utilities, and dashboards. Its purpose is not to *be* the tools — but to host, organize, embed, link to, and surface data from them, so that everything you've built lives behind one URL with one identity and one consistent interface.

### 1.2 Problem Statement
Personal projects accumulate. Each lives in its own repo, port, URL, and UI. Switching contexts is friction. Forgetting what exists is friction. Logging in repeatedly is friction. The Center exists to eliminate that friction by being the single front door.

### 1.3 Product Goals
1. **Single front door** — one URL, one login, every tool reachable in ≤2 clicks.
2. **Extensible by design** — adding a new module should take minutes of configuration, not days of integration work.
3. **Mobile-first** — every screen must be usable on a phone, since most "lazy" use is from the couch or bed.
4. **Low maintenance** — once deployed, it should run for months without intervention. Boring tech, sensible defaults.
5. **Heterogeneous integration** — must gracefully host *embedded* modules (iframes, sub-apps) and *linked* modules (external apps) side-by-side, with a unified dashboard surfacing data from both.

### 1.4 Non-Goals
- Not a public/multi-tenant product. Single user (you), with eventual narrow sharing (e.g., girlfriend for finance).
- Not a replacement for the modules themselves. The Center has no business logic of its own beyond hosting/aggregating.
- Not a CMS, not a Notion clone, not an OS.

### 1.5 Definitions
- **Center** — the shell webapp described in this document.
- **Module** — any tool/utility/app surfaced through the Center. Three flavors, distinguished by how the Center serves them:
  - **`proxy_subpath` module** — runs under the Center's domain at a subpath (e.g., `center.tld/meals/`), served directly by the reverse proxy. Shares identity and design tokens. Preferred for first-party embedded modules.
  - **`iframe` module** — embedded inside the Center's chrome via iframe + `postMessage`. Useful when a module's UI can't easily share the Center's layout (e.g., a legacy app, a third-party tool you want to wrap).
  - **`linked` module** — an external standalone app the Center links to in a new tab and/or pulls dashboard data from via its widget API (e.g., the finance tracker).
- **Widget** — a small dashboard component owned by a module, rendered on the Center's home screen.

---

## 2. Overall Description

### 2.1 User Profile
A single power user (you) — technical, comfortable with config files, running a home server or VPS. One additional fully-trusted user (girlfriend), with the same access as you but a different default home-screen (some technical/admin modules hidden by default — she can opt-in if she ever cares). No expectation of onboarding flows, tooltips, or hand-holding.

### 2.2 Operating Environment
- **Deployment:** Self-hosted on home server or VPS (Docker-based, single-host).
- **Access:** Public-facing via reverse proxy (Caddy or Traefik) with HTTPS, accessible from any device.
- **Clients:** Modern desktop browsers + mobile browsers. Optional PWA install for phone home-screen access.

### 2.3 Design & UX Constraints
- Mobile-first responsive layout. Desktop is the secondary form factor.
- Dark mode by default; light mode optional.
- Consistent visual language across embedded modules (shared design tokens / CSS variables).
- Keyboard shortcuts on desktop (`Cmd/Ctrl+K` global search/launcher).
- No unnecessary animations or splash screens — the Center should feel instant.

### 2.4 Assumptions & Dependencies
- You control DNS for a domain pointing at the host.
- You have or will set up a reverse proxy with auto-TLS (Caddy recommended for simplicity).
- Modules expose either a web UI (for iframe embedding) or a JSON API (for dashboard data and/or inter-module calls), or both.
- Modules that need auth either trust the Center's reverse-proxy headers (for user requests) or accept Center-issued service tokens (for inter-module calls).
- Inter-module API calls happen over the internal Docker network; the reverse proxy is not in the path for service-to-service traffic.

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
                       ┌──────────────────────────┐
                       │   Reverse Proxy (Caddy)   │
                       │  TLS, routing, auth gate  │
                       └────────────┬──────────────┘
                                    │
              ┌─────────┬───────────┼───────────┬─────────┐
              │         │           │           │         │
              ▼         ▼           ▼           ▼         ▼
      ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
      │   Center     │  │ proxy_subpath│  │   iframe     │  │   linked     │
      │   (shell)    │  │   modules    │  │   modules    │  │   modules    │
      │              │  │ (sub-apps)   │  │ (wrapped UI) │  │  (external)  │
      └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
             │                 │                 │                 │
             ▼                 ▼                 ▼                 ▼
      ┌─────────────────────────────────────────────────────────────────┐
      │                    Shared Services Layer                          │
      │     Auth (OIDC/session)  │  Module Registry  │  Event Bus (v2)    │
      │     Notifications        │  Secrets Vault    │  Postgres / Redis  │
      └─────────────────────────────────────────────────────────────────┘
```

> `linked` modules consume the Shared Services Layer only loosely — typically just auth (OIDC) and the widget-pull endpoint. The Center reaches out to them, not the other way around.

### 3.2 Component Responsibilities

**The Center Shell**
- Renders the dashboard, navigation, settings, and module launcher.
- Owns the module registry (which modules exist, where they live, what widgets they provide).
- Aggregates widget data from modules into the dashboard.
- Provides global UI: search, command palette, notifications, theme.

**Shared Services Layer**
- **Auth Service** — single source of identity for users (sessions via OIDC, propagated to modules via forward-auth headers) *and* services (Center mints short-lived JWTs that modules use to authenticate inter-module API calls — see §3.5).
- **Module Registry** — config + DB table listing every module (name, type, URL, icon, widget endpoints, internal API base URL, default visibility, declared events).
- **Service Discovery** — modules ask the Center "where is module X?" and get back its internal URL. Backed by the registry; exposed as a small client SDK convention.
- **Event Bus** — Redis-backed pub/sub and streams for fact-broadcasts between modules (see §3.6). Promoted to v1 since real cross-module workflows are an immediate goal.
- **Notifications Service** — subscribes to relevant events and dispatches via push/email/in-app.
- **Secrets Vault** — for module API keys/tokens. SOPS-encrypted file or a minimal vault.
- **Postgres** — single shared instance, schema-per-module, user-per-module. See §3.7.
- **Redis** — shared instance for Center-owned concerns: sessions, rate limits, event bus. Modules' *internal* queues live in their own Redis if they need one (see module-internal infrastructure note below).

**Modules**
- `proxy_subpath`: live behind a subpath (`center.tld/meals/`), routed there by the reverse proxy. Next.js never sees these requests. They're free to be any stack.
- `iframe`: embedded into a Center page via iframe. The Center renders a wrapper page (header/nav) and the iframe inside; height/events flow via `postMessage`.
- `linked`: live anywhere. Register with the Center by providing a manifest (see §4.3). The Center may render their widgets but never embeds their UI.

> **Module-internal infrastructure is the module's own concern.** Async workers, message brokers, caches, scrapers, headless browsers, ML models — none of these are the Center's business. A module may run its own Redis/queue (Celery, Asynq, BullMQ, etc.) inside its container group and expose only the widget JSON contract to the Center. Sharing infrastructure across modules is allowed but discouraged; coupling failure domains across unrelated tools defeats the point of modularity. The shared Redis in §3.2 exists for *Center-owned* concerns (sessions, rate limiting, eventually the event bus), not for modules' internal queues.

### 3.3 Architectural Style
**Modular monolith with detachable modules.** The Center shell + shared services run as one cohesive app. Modules are independent processes (their own containers, repos, languages) that *plug into* the shell via well-defined contracts. This gets you the cleanliness of microservices for the modules without the operational pain of a full microservice mesh for the core.

### 3.4 Technology Stack

| Layer | Choice | Why |
|---|---|---|
| Center frontend + backend | **Next.js (App Router) + TypeScript + Tailwind** | One codebase, shared types between FE/BE, SSR for fast mobile, easy PWA. Backend lives in API routes / server components — no separate service needed at the Center's scale of work. |
| Auth | Authelia or Pocket-ID (self-hosted OIDC) | One login for Center + all modules via forward-auth |
| DB | PostgreSQL 16 (single instance, schema-per-module) | See §3.7 |
| Cache/Bus | Redis (single instance, Center-owned use only) | Sessions, rate limits, event bus |
| Reverse Proxy | Caddy | Auto-TLS, dead-simple config, forward-auth built in |
| Container Orchestration | Docker Compose | Single-host, low overhead. Move to K3s only if you outgrow it |
| Secrets | SOPS + age | Git-safe encrypted secrets |
| Monitoring | Uptime Kuma + Dozzle | Lightweight, no Prometheus stack needed unless you want it |

**Polyglot rule for modules:** the Center is fixed at Next.js/TS so frontend and backend share types and the JS ecosystem (NextAuth, shadcn/ui, lucide, swr, react-query) does the heavy lifting. *Modules are free to use whatever fits the job* — Go for high-concurrency scrapers (AliExpress bot, manhwa parser), Python for ML-flavored work, TS where convenient. Modules speak to each other and to the Center only through JSON over HTTP and Redis events, so language choice is encapsulated.

> Swap any layer if you have a strong preference. The architecture doesn't depend on Next.js specifically — but the decision is now made.

### 3.5 Inter-Module Communication

Modules talk to each other in two distinct ways. Picking the right one per situation matters.

**Synchronous HTTP — for queries and commands.** Use when the caller needs an answer before continuing. Examples:
- Meal module → Pantry module: "Do I have flour, eggs, butter?" — needs the answer to decide what to suggest next.
- Meal module → Tasks module: "Create a shopping task for these items" — needs the task ID to link back.
- Tasks module → Calendar module: "Find me an open 30-min slot tomorrow" — needs the slot.

**Events (Redis) — for fact-broadcasts.** Use when something happened and any module that cares can react independently. Examples:
- `pantry.purchase.recorded` → finance logs the expense, tasks closes the shopping task, pantry updates inventory.
- `calendar.event.created` → notifications service schedules a reminder.

**Rule of thumb:** if the caller needs a return value, it's an API call. If the caller is announcing a fact and doesn't care who listens, it's an event.

**Service discovery:** modules don't hardcode each other's URLs. They ask the Center: `GET center.internal/registry/services/pantry` → `{ "base_url": "http://pantry:8000/api" }`. A small per-language client SDK wraps this lookup, caches the result, and handles the auth (below). When you add a new module, no other module needs to be redeployed.

**Inter-module auth:** module-to-module calls aren't user requests — there's no logged-in browser involved. The Center mints short-lived JWTs (5-minute TTL) that modules use to authenticate to each other. Each module verifies the JWT signature using the Center's public key (fetched once on startup) and trusts requests from any module the Center vouched for. No per-module-pair secret management.

**Failure handling:** inter-module HTTP calls **must** time out (default 3s, configurable) and **must** handle the called module being down. The expected pattern: try the call → on failure, log + degrade gracefully (e.g., meal module skips the pantry check and just suggests recipes without ingredient filtering). One module being down never cascades.

**Orchestration lives in modules, not the Center.** The "request recipe → check pantry → create task → find calendar slot" workflow is orchestrated *inside the meal module*. The Center never owns cross-module business logic. If three modules ever need to coordinate in a way no single module owns, *that* is a real design problem to solve when it appears — don't preemptively build a workflow engine.

### 3.6 Event Bus Design

Promoted from v2 to v1 since real cross-module use cases exist from day one.

**Transport:** Redis (already in the stack). Two flavors per event, declared in the manifest:
- **Pub/Sub** for lossy fire-and-forget. Examples: "scraper found a deal," "user viewed a recipe." If the subscriber is down, the event is lost. That's fine for these.
- **Streams** for events that must not be lost. Examples: "purchase recorded," "task completed," "calendar event created." Persisted, consumer-group semantics, redelivery if the subscriber crashes mid-processing.

**Naming convention:** `<domain>.<thing>.<verb_past_tense>` — e.g., `pantry.purchase.recorded`, `calendar.event.created`, `tasks.task.completed`. Consistent and greppable.

**Payload schema:**
```json
{
  "event": "pantry.purchase.recorded",
  "version": 1,
  "ts": "2026-05-16T15:30:00Z",
  "source_module": "pantry",
  "data": { "items": [...], "total_cost": 12.50, "currency": "USD" }
}
```
Version the schema from day one — when you change a payload, bump the version and have subscribers handle both for a transition period.

**Subscriber responsibilities:**
- Idempotency. Streams may redeliver. Subscribers de-duplicate by event ID or by the natural keys in `data`.
- Don't block. Subscribers should ack the event, queue work internally, return. The event bus is not a job queue.
- Handle schema drift. Subscribe to a version range, not a single version.

**Manifest declarations** make the event surface inspectable — see §4.3.

### 3.7 Database Model

**One Postgres instance. One schema per module. One DB user per module.**

- Center owns the `center` schema.
- Each module owns its own schema (`meals`, `pantry`, `finance`, `tasks`, `calendar`, ...).
- Each module connects with credentials that have `USAGE` and `CREATE` on its own schema and *no access* to others. A bug in the meal picker cannot corrupt the finance ledger.
- **No cross-schema foreign keys.** If module A references data owned by B, it stores B's ID as an opaque value and goes through B's API (or an event) to resolve it. Cross-schema FKs would couple modules at the DB level and defeat the modular architecture.
- Migrations are per-module — each module owns its schema migrations and runs them on its own startup.

**When to revisit:** if a single module's data starts dominating disk or IO, give it its own Postgres instance. The schema boundary makes that migration straightforward — `pg_dump --schema=meals` and restore into a new instance, update the module's connection string. You're unlikely to hit this for years.

---

## 4. Functional Requirements

### 4.1 Core Features

**FR-1: Dashboard**
- Customizable grid of widgets sourced from registered modules.
- Each widget pulls its data from the owning module's `/widget` endpoint.
- Drag-to-reorder, hide/show widgets per user.
- Widgets refresh on a configurable interval; manual refresh available.

**FR-2: Module Launcher**
- App-grid view of all modules (icon + name + short description).
- `Cmd/Ctrl+K` opens a fuzzy search palette that searches modules + recent items.
- Each module clearly tagged by type: `proxy_subpath` and `iframe` open in-app; `linked` opens in a new tab (visibly marked).

**FR-3: Authentication & Authorization**
- Single sign-on across Center and modules via OIDC for user requests.
- Service-to-service auth via Center-minted JWTs for inter-module API calls (see §3.5).
- Session-based for browser; API token support for programmatic access.
- Two user roles: `admin` (full access including registry/admin pages) and `user` (full module access, no admin pages). No per-module permission boundaries — both users are trusted.
- Default home-screen differs by user via `default_hidden` on the manifest (see §4.3); any user can opt-in to seeing hidden modules.

**FR-4: Module Registry & Management**
- Admin UI (admin role only) to add/remove/edit modules.
- Module manifest (YAML) declares: id, name, icon, description, type (`proxy_subpath` | `iframe` | `linked`), URL, internal API base URL, health-check URL, widgets, published/subscribed events, default visibility per user.
- Health-check pings show each module's up/down status.

**FR-5: Notifications**
- In-app notification center.
- Optional push (web push) and email channels.
- Modules POST to a central `/notify` endpoint to raise notifications.

**FR-6: Settings & Preferences**
- Theme (dark/light/auto).
- Dashboard layout.
- Notification channel preferences.
- Module ordering and visibility.

**FR-7: Module Rendering**

The Center renders modules differently based on their declared `type`:

- **`proxy_subpath`** — The reverse proxy routes the subpath directly to the module's container. The Center's Next.js app is bypassed entirely for these requests. The module is expected to honor the Center's design tokens (CSS variables) for visual consistency. The Center contributes only a top-level navigation bar via a slim header injected by the proxy (optional).
- **`iframe`** — A catch-all Next.js route (`app/m/[moduleId]/page.tsx`) reads the manifest, renders the Center's chrome, and embeds the module via iframe. Height and navigation events flow via `postMessage`. No per-module React code is written; new iframe modules are added by manifest only.
- **`linked`** — The launcher entry opens in a new tab. The Center may also render a "detail" page (the same catch-all route, in `linked` mode) showing the module's widget(s) plus a launch button.

The catch-all route is the single rendering surface for every module case the Center *does* render. Adding a module never requires writing new React pages.

**FR-8: Widget Aggregation**

Any module — regardless of type — may contribute dashboard widgets by declaring widget endpoints in its manifest. The Center polls these endpoints on each widget's configured interval, caches the latest payload, and renders them on the dashboard. A widget is a small JSON payload (title, primary value, optional secondary, optional sparkline data, optional deep link) — the Center owns the rendering. This means a `linked` module hosted on an entirely separate machine can still surface live data on the Center's dashboard with no UI coupling.

### 4.2 User Stories

- *As me*, I open `center.mydomain.tld` on my phone and see today's meal suggestion, my finance balance, and any new manhwa chapters in one glance.
- *As me*, I hit `Cmd+K` on desktop, type "ali", press Enter, and I'm in the AliExpress bot.
- *As me*, I add a new module by editing a YAML file and restarting the Center — it appears in the launcher.
- *As my girlfriend*, I log into the Center and only see the Finance app; everything else is hidden.

### 4.3 Module Manifest (Contract)

Every module — `proxy_subpath`, `iframe`, or `linked` — registers via a manifest:

```yaml
id: meal-picker
name: Meal Picker
description: Pick a meal, get a recipe
icon: utensils                  # lucide icon name or path to SVG
type: proxy_subpath             # proxy_subpath | iframe | linked
url: /meals                     # subpath for proxy_subpath/iframe, full URL for linked
internal_api: http://meals:8000/api   # base URL for inter-module calls (Docker network)
health_check: /meals/api/health
default_hidden:                 # users who don't see this in their launcher by default
  - girlfriend                  # can be toggled on in settings if desired
widgets:
  - id: tonight
    endpoint: /widget/tonight   # relative to internal_api
    refresh_seconds: 3600
events:
  publishes:
    - { name: meals.recipe.requested, transport: pubsub }
    - { name: meals.cooking.started, transport: stream }
  subscribes:
    - pantry.purchase.recorded  # to update what we know is in stock
    - pantry.inventory.changed
```

Field notes:
- `type` determines how the Center renders the module (see FR-7).
- `url` is a subpath for `proxy_subpath` and `iframe` types, and an absolute URL for `linked`.
- `internal_api` is the base URL other modules use for direct API calls. Lives on the Docker internal network, not exposed publicly.
- `health_check` is optional but recommended; the Center pings it and shows status in the launcher.
- `default_hidden` is a *visibility hint* per user, not a security boundary. Listed users won't see the module in their launcher unless they toggle it on in settings. Omit to show to everyone by default.
- `widgets` is optional. A module that contributes no dashboard data simply omits it.
- `events.publishes` and `events.subscribes` declare the module's event surface. The Center surfaces this in the admin UI so the wiring stays inspectable.

The widget endpoint returns:
```json
{
  "title": "Tonight",
  "primary": "Pad Thai",
  "secondary": "ready in 25 min",
  "link": "/meals/recipes/pad-thai"
}
```

**Minimum contract per module type:**
- `linked` with no widgets: just `id`, `name`, `type`, `url`. That's a launcher entry.
- `proxy_subpath` / `iframe` with no widgets: same plus no need for `internal_api` if nothing else calls it.
- Any module participating in cross-module workflows: `internal_api` + relevant events.
- Any module on the dashboard: `widgets`.

A module starts minimal and grows its manifest as it gains responsibilities.

---

## 5. Non-Functional Requirements

### 5.1 Performance
- Dashboard initial load < 1.5s on mobile over 4G.
- Widget refresh non-blocking; failed widgets degrade gracefully (show last known + error icon).
- Center's own footprint < 200MB RAM idle.

### 5.2 Reliability
- Center uptime target: 99% (this is personal infra, not a bank).
- One module crashing must never take down the Center or other modules.
- All inter-module communication is fault-tolerant (timeouts, retries, fallbacks).

### 5.3 Security
- All traffic HTTPS via reverse proxy.
- OIDC for SSO; no plaintext passwords stored.
- Secrets never committed to git — SOPS-encrypted only.
- Admin paths gated at the proxy layer (forward-auth checks `admin` group claim); modules trust the user identity propagated in headers.
- Inter-module API calls authenticated via short-lived Center-minted JWTs (see §3.5).
- CSP headers; iframes sandboxed unless from trusted module list.

### 5.4 Maintainability
- All config in version control except secrets (which are encrypted in version control).
- One-command deploy: `docker compose up -d`.
- Module additions require zero Center code changes — only manifest registration.
- Structured logs (JSON) from every service to stdout.

### 5.5 Usability
- Mobile-first; touch targets ≥44px.
- Works offline for cached dashboard (PWA service worker).
- Keyboard-navigable on desktop.
- No login wall on every navigation — sessions last 30+ days on trusted devices.

### 5.6 Extensibility
- Adding a module: write manifest → restart Center → done.
- Adding a widget type: limited to the JSON contract for v1; v2 may allow custom React widgets via federation.
- Swapping the auth provider: should be one config change, since everything goes through forward-auth.

---

## 6. Data Model (Center-Only)

The Center owns the `center` schema only. Modules own their own schemas. No cross-schema FKs (see §3.7).

```
center.users
  id, email, name, role ('admin' | 'user'), created_at

center.modules
  id, manifest_yaml, enabled, last_health_check, last_health_status

center.user_preferences
  user_id, key, value_json
  -- single flexible KV table for: dashboard_layout, hidden_modules,
  -- notification_channels, theme, etc. Keeps the schema stable as
  -- preferences grow.

center.notifications
  id, user_id, source_module, title, body, link, read_at, created_at

center.sessions          -- only if not fully delegated to OIDC provider
  id, user_id, expires_at, device_label

center.service_tokens    -- short-lived JWTs are signed not stored,
                         -- but we may keep a revocation list
  jti, revoked_at
```

Note the absence of any ACL table — the role on `users` covers admin-vs-user, and module visibility is a per-user *preference*, not a permission boundary.

That's it. The Center is deliberately data-light.

---

## 7. Phased Rollout Plan

**Phase 0 — Foundation (1-2 weekends)**
- Domain + reverse proxy + TLS.
- Auth provider deployed (Authelia or Pocket-ID).
- Empty Center app: login, a placeholder dashboard, a placeholder launcher.
- Postgres + Redis up.
- Docker Compose deploys everything.

**Phase 1 — Module Plumbing (1 weekend)**
- Module manifest loader + schema validation.
- Module registry CRUD (admin page).
- Launcher renders modules from registry.
- Health-check pings + status indicators.
- Per-user visibility honoring `default_hidden`.

**Phase 2 — Dashboard (1 weekend)**
- Widget contract implemented.
- Two demo widgets (hardcoded) prove the flow.
- Dashboard layout persistence per user.

**Phase 3 — Inter-Module Communication (1 weekend)**
- Service discovery endpoint: `GET /registry/services/:id`.
- JWT minting endpoint + public key endpoint.
- Reference client SDK in TypeScript (and Go/Python skeletons) demonstrating service discovery + auth.
- Event bus wiring: Redis pub/sub + streams helpers in the SDK.
- Manifest fields `internal_api` and `events` honored and surfaced in admin UI.

This phase exists *before* real modules to lock in the contracts. Otherwise, the first two modules invent ad-hoc patterns and you spend Phase 5 refactoring them.

**Phase 4 — First Real Module (the easy one)**
- Pick the manhwa parser. Integrate as `proxy_subpath`, contribute a widget. No inter-module calls or events yet.
- Iterate on the contract based on what hurt.

**Phase 5 — First Cross-Module Workflow (the meal-pantry pair)**
- Build meal-picker + pantry as two modules.
- Meal module calls Pantry module synchronously to check ingredients.
- Pantry module publishes `pantry.purchase.recorded` events.
- This is the canonical reference workflow for everything that comes after.

**Phase 6 — Deferred.**
Originally planned as finance integration: `pantry.purchase.recorded` → auto-logged expense in FinGuide. Skipped because FinGuide already auto-imports expenses from MoMo SMS, making the integration redundant and prone to creating duplicate transactions.

Eventual scope when revisited — do each in isolation when it becomes a concrete felt need, not all at once:

- **Finance dashboard widgets** (highest priority, lowest dependency): month spend, top savings goal progress, financial health score. Needs only widget endpoints on FinGuide and manifest registration in the Center. No event bus or inter-module calls required.
- **Uncategorized transaction surfacing via tasks**: FinGuide calls `POST /api/tasks` on the tasks module when uncategorized transactions accumulate beyond a threshold. Requires the tasks module to exist first.
- **Calendar events for scheduled investment contributions**: FinGuide calls `POST /api/events` on the calendar module for each contribution day. Requires the calendar module to exist first.

FinGuide is registered as a launcher-only `linked` module in the meantime — just a tile with a URL, no widgets or events yet.

**Phase 7 — Polish**
- PWA manifest + service worker.
- Notification center wired to events.
- Command palette (`Cmd/Ctrl+K`).
- Mobile UX pass.
- Shared top-bar navigation across `proxy_subpath` modules.

**Beyond Phase 7 — Future modules follow the existing module SRS template, not a phase plan.**
The project has exited formal phased rollout. Future modules are added based on actual felt need, not roadmap order. Each new module gets an SRS (from `docs/module-srs-template.md`), a manifest, and a place in the launcher — no phase number required.

---

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Scope creep (Center grows business logic) | High | High | Strict rule: Center has no domain logic. If it's about meals, manhwa, or money, it lives in a module. |
| Module contract churn | Medium | Medium | Version the manifest schema. Modules declare which version they target. |
| Cross-module orchestration leaks into the Center | High | High | Workflows live *inside* the originating module. The Center provides transport (HTTP discovery, events), never workflow logic. |
| Tight coupling between modules via direct API calls | Medium | Medium | Each module has well-defined public API surfaces. Modules degrade gracefully when callees are down (timeouts + fallback). |
| Event schema drift | Medium | Medium | Events ship a `version` field; subscribers handle ranges. Manifest declares published versions. |
| Auth complexity | Medium | High | Pick one OIDC provider (Authelia/Pocket-ID) early, stick with it. Forward-auth keeps modules dumb. JWT minting for service-to-service is small and contained. |
| Mobile UX neglect | Medium | High | Build every screen on a 375px viewport first; desktop is "added later." |
| You stop using it | Medium | Total | Make Phase 0-2 brutally minimal. Get something usable in 2 weekends. Momentum matters. |

---

## 9. Decisions Made & Remaining Open Questions

### 9.1 Decisions Made

| # | Question | Decision | Why |
|---|---|---|---|
| D1 | Subpaths vs subdomains for embedded modules | **Subpaths** | One cookie domain, one TLS cert, simpler proxy config, no CORS, trivial same-origin `postMessage`. Cookie isolation loss is irrelevant for self-trusted modules. Modules must root their app at their configured subpath (e.g., Next.js `basePath`). |
| D2 | Shared Postgres vs per-module DBs | **Shared, schema-per-module, user-per-module** | One ops surface; logical isolation via schemas; no cross-schema FKs. Easy to extract a heavy module later. |
| D3 | Mobile app shell | **PWA only** | Covers home-screen install, offline cache, push. Native shell is overkill. |
| D4 | ACL model | **No ACL; admin/user roles + `default_hidden` preference** | Both users are fully trusted. Admin role gates admin pages; everything else is per-user visibility preference. |
| D5 | Event bus | **In v1, Redis-backed, Pub/Sub + Streams per event** | Real cross-module workflows are immediate (meal ↔ pantry ↔ tasks ↔ calendar ↔ finance). See §3.6. |
| D6 | Backend framework | **Next.js (API routes / server components)** | Center is a thin shell; co-locating FE and BE in one TS codebase is a clear win. Modules can still be polyglot. |
| D7 | Inter-module communication | **Sync HTTP for queries/commands + events for fact-broadcasts (both v1)** | Real use cases (meal checking pantry) need synchronous answers, not events. See §3.5. |

### 9.2 Still Open

1. **Where exactly does admin-vs-user enforcement live?** Forward-auth at the proxy is cleanest (the admin paths require an `admin` group claim), but the Center may need to read the role server-side anyway for UI conditionals. Decide during Phase 0 when auth is wired.
2. **JWT signing key rotation** for service tokens. Day one: a single key in SOPS. Eventually: a key set with rotation. Don't build the rotation until you have it bothering you.
3. **How do modules declare their schema migrations?** Each module owns its migration tooling, but the Center should at least *know* which schema version is deployed for each module (for diagnostics). A `/version` endpoint on each module's API, scraped alongside the health check, is probably the answer. Decide during Phase 3.
4. **Should the notification service be its own module or part of the Center?** Currently sketched as part of the Center's shared services. If it grows complex (multi-channel, templates, scheduling), pull it out into a real module. Watch this in Phase 7.

---

## 10. Definition of Done (for the Center, v1)

The Center is "done enough to start adding modules in earnest" when:
- ✅ Deployed at your domain with HTTPS.
- ✅ Login works; sessions persist across reload.
- ✅ At least two modules registered, covering at least two of the three types (`proxy_subpath`, `iframe`, `linked`).
- ✅ Dashboard shows at least one widget from each.
- ✅ Mobile experience is good enough that you actually open it on your phone.
- ✅ Adding a third module requires only a manifest edit.

After that, the Center fades into the background and the modules become the work.
