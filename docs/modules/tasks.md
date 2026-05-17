# Module SRS — `tasks`

**Version:** 0.1
**Date:** May 2026
**Module type:** `proxy_subpath`
**Status:** Draft

## 1. Purpose

A unified task list. Other modules push tasks into it; the user reviews and completes them in one place. Replaces the situation where every utility would otherwise either (a) re-implement a TODO UI, or (b) leave actionable items siloed.

## 2. Scope

**In scope:**
- A list of tasks: title, optional notes, source module, status, created/completed timestamps.
- Categorization by source (shopping, reading, review, generic).
- Manual task creation by the user.
- Marking tasks done.
- An API for other modules to create, query, and update tasks.
- A widget showing "what's pending."

**Out of scope:**
- Scheduling / calendar slots (that's the future `calendar` module — tasks emits an event when a task is created, calendar can subscribe if you want auto-scheduling later).
- Recurring tasks (v0.2 maybe; v0.1 ships without).
- Subtasks / hierarchies (deliberate — keeps the data model flat and the UI fast).
- Reminders/notifications (the `notifications` service in the Center handles that, subscribing to task events).
- Project management / tags / priorities beyond a single `urgent` flag.

## 3. User Stories

- As me, meal-picker tells me I'm missing eggs and butter. I tap "add to shopping list" and a single task appears in tasks: "Buy eggs and butter (from meals)."
- As me, I open tasks on my phone, see the shopping list, the manhwa-to-read list, and the "review these AliExpress products" list grouped by source. Tap to complete.
- As me, I add a one-off task manually: "Call landlord."
- As my girlfriend, I see the same shared task list and can add/complete items.

## 4. The Module Manifest

```yaml
id: tasks
name: Tasks
description: One list to rule them all
icon: list-checks
type: proxy_subpath
url: /tasks
internal_api: http://tasks:8000/api
health_check: /tasks/api/health
widgets:
  - id: pending
    endpoint: /widget/pending
    refresh_seconds: 300
events:
  publishes:
    - { name: tasks.task.created,   transport: pubsub }
    - { name: tasks.task.completed, transport: stream }
  subscribes: []
```

`tasks.task.completed` is a stream because other modules (e.g., a future "habits" or "stats" module) might want durable counting. `tasks.task.created` is pubsub because subscribers (notifications, calendar) only need to react in real time; missing one is fine.

Tasks subscribes to nothing in v0.1 — it's purely an inbox. Notably it does **not** subscribe to `pantry.purchase.recorded` to auto-close shopping tasks; the closing happens because the meal-picker (or the user) explicitly marks the task done. This keeps the causal chain visible.

## 5. Public API

### `POST /api/tasks`

- **Purpose:** create a task.
- **Caller:** any module, plus the tasks UI itself.
- **Auth:** service token (for modules) or user session (for the UI).
- **Request body:**
  ```json
  {
    "title": "Buy eggs and butter",
    "notes": "For pad-thai tonight",
    "category": "shopping",
    "sourceRef": "meals:recipe:pad-thai",
    "urgent": false
  }
  ```
  - `title` (required, max 200 chars).
  - `notes` (optional, max 2000 chars, markdown rendered in UI).
  - `category` (required, enum: `shopping` | `reading` | `review` | `generic`).
  - `sourceRef` (optional, opaque string — used by the source module to find its own tasks later).
  - `urgent` (optional, default false).
  - The calling module is taken from the JWT `sub`; user requests are tagged with source `user`.
- **Response:** `201 Created`, `{ id, createdAt }`.
- **Side effect:** publishes `tasks.task.created`.

### `POST /api/tasks/:id/complete`

- **Purpose:** mark a task done.
- **Caller:** user session (UI) or service token (e.g., a module that knows the user finished the underlying work).
- **Request body:** empty or `{ completedNotes?: string }`.
- **Response:** `204 No Content`.
- **Side effect:** publishes `tasks.task.completed`.
- **Errors:** `404` if task doesn't exist, `409` if already completed.

### `GET /api/tasks`

- **Purpose:** list tasks (UI and dashboard widget).
- **Caller:** user session or service token.
- **Query params:**
  - `status`: `pending` | `completed` | `all` (default `pending`).
  - `category`: optional filter.
  - `source`: optional filter (e.g., `meals`).
  - `limit`: int, default 100.
- **Response:** `{ tasks: [{ id, title, notes, category, source, sourceRef, urgent, status, createdAt, completedAt }] }`.

### `GET /api/tasks/by-source-ref`

- **Purpose:** find a task by its `sourceRef`. Lets a calling module check "did I already create this task?"
- **Query params:** `sourceRef` (required), `status` (optional, default `pending`).
- **Response:** `{ tasks: [...] }` (zero or more matches).
- **Why it exists:** without this, meal-picker would create a duplicate shopping task every time the user looks at the same recipe. The caller can check first, or just always call and rely on its own dedup.

### `GET /widget/pending`

- **Purpose:** dashboard widget.
- **Auth:** service token (Center poller).
- **Response:**
  ```json
  {
    "title": "Pending",
    "primary": "7 tasks",
    "secondary": "2 urgent · 3 shopping",
    "link": "/tasks"
  }
  ```
  Empty state: `primary: "All clear"`, no secondary.

## 6. Events

### Published

| Event | Transport | When | Payload |
|---|---|---|---|
| `tasks.task.created` | pubsub | Task created | `{ id, title, category, source, sourceRef, urgent, createdAt }` |
| `tasks.task.completed` | stream | Task marked done | `{ id, title, category, source, sourceRef, completedAt, completedBy }` |

`completedBy` is either a user ID (if completed via UI) or a module ID (if completed via API by another module). Useful for downstream stats.

### Subscribed

None in v0.1.

## 7. Widgets

### `pending`

- **What it shows:** pending task count and a brief breakdown.
- **Refresh:** 300s.
- See payload spec above.

## 8. Data Ownership

```
tasks.tasks
  id (uuidv7), title, notes, category, source, source_ref,
  urgent, status, created_at, created_by, completed_at, completed_by

tasks.event_outbox       -- not in v0.1, slot for v0.2 if event loss bites
  id, event_name, payload, created_at, published_at
```

`source` is the module ID that created it (or `user`). `source_ref` is opaque to tasks — only the source module interprets it.

## 9. External Dependencies

None.

## 10. Internal Architecture

TypeScript + Next.js, served at `/tasks`. API routes under `/tasks/api/*`. Postgres via `pg`, schema `tasks`. Uses LC TypeScript SDK. No internal workers.

Single container: `tasks`.

## 11. Failure Modes & Degradation

- **Center registry unreachable:** tasks doesn't call other modules, so this only affects service-token validation on incoming calls. SDK caches the Center's public key — tasks continues serving as long as the cached key is valid (5 min). Beyond that, incoming module calls fail `unauthorized`; the user UI still works.
- **A module that calls tasks is misbehaving:** tasks validates input (title length, category enum) and lets malformed requests fail loudly. No rate-limiting in v0.1 because all callers are trusted.
- **Redis down — publishing:** events dropped, logged. Acceptable for v0.1. The outbox slot in §8 exists for when this becomes a real problem (likely never).
- **Redis down — subscribing:** N/A, tasks subscribes to nothing.
- **DB down:** crash + restart.

## 12. Open Questions

1. **Duplicate detection.** Right now, a caller checks `by-source-ref` then creates if missing — there's a race. v0.1 accepts duplicates; user can complete both. v0.2 might add a `createIfAbsent` flag that does it atomically.
2. **Task ordering in the UI.** Sort by urgent → created_at desc? By source? User-configurable? Decide after a week of use.
3. **What does meal-picker do when a shopping task is completed?** Does meal-picker care? Probably not (purchase events from pantry are the real "ingredients are now available" signal). Confirm during integration.
