# Module SRS — `calendar`

**Version:** 0.1
**Date:** May 2026
**Module type:** `proxy_subpath`
**Status:** Draft

> The final pre-build module spec. Calendar exists because "find a slot for this task" appears in the canonical workflow and would otherwise leak into tasks as a scheduling field.

---

## 1. Purpose

A personal calendar that holds time-bound commitments and exposes "when am I free?" to other modules. Used directly by you (and your girlfriend) to plan the week, and consumed programmatically by other modules that need to slot tasks into available time.

## 2. Scope

**In scope:**
- A list of events with start time, duration, title, optional notes, and source attribution.
- Manual event creation by the user.
- Programmatic event creation by other modules (e.g., tasks asks calendar to schedule something).
- A "find an open slot" API that returns the next available time window matching constraints.
- A widget showing what's next on the calendar.

**Out of scope:**
- External calendar sync (Google Calendar, iCloud, etc.) — v0.2+ problem.
- Recurring events — v0.2.
- Multi-day events / all-day events — v0.2 (v0.1 ships timed-only).
- Sharing or invites between users — both users see the same shared calendar, no per-user view. Matches the rest of the system: one calendar, two viewers.
- Reminders/notifications — handled by the `notifications` service subscribing to calendar events.
- Time-zone juggling — single-timezone for v0.1 (your local). The system stores UTC internally; UI renders local.

## 3. User Stories

- As me, I open the calendar on my phone, see what I have today and tomorrow, add a one-off event ("dentist Friday 2pm").
- As me, tasks asks calendar "find me a 30-min slot for grocery shopping" → calendar replies with the next available window, tasks decides whether to book it.
- As me, the dashboard shows my next event so I don't blow past appointments.
- As my girlfriend, I see and edit the same calendar.

## 4. The Module Manifest

```yaml
id: calendar
name: Calendar
description: When am I free? When am I busy?
icon: calendar-days
type: proxy_subpath
url: /calendar
internal_api: http://calendar:8000/api
health_check: /calendar/api/health
widgets:
  - id: next-up
    endpoint: /widget/next-up
    refresh_seconds: 300
events:
  publishes:
    - { name: calendar.event.created,   transport: pubsub }
    - { name: calendar.event.cancelled, transport: pubsub }
  subscribes: []
```

Both events are pubsub — they're real-time cues for notifications. Nothing critical hinges on durability. Calendar subscribes to nothing in v0.1; modules that want to schedule things call calendar's API rather than firing an event for calendar to pick up. Synchronous makes sense because the caller needs the booked slot returned.

## 5. Public API

### `POST /api/events`

- **Purpose:** create an event.
- **Caller:** the calendar UI, or any module wanting to schedule something.
- **Auth:** user session or service token.
- **Request body:**
  ```json
  {
    "title": "Grocery shopping",
    "notes": "From tasks: shopping list",
    "startsAt": "2026-05-17T14:00:00Z",
    "durationMinutes": 30,
    "sourceRef": "tasks:task:abc123"
  }
  ```
  - `title` (required, max 200).
  - `notes` (optional, max 2000).
  - `startsAt` (required, ISO-8601 UTC).
  - `durationMinutes` (required, integer 5–1440).
  - `sourceRef` (optional, opaque — module ID is inferred from the JWT).
- **Response:** `201 Created`, `{ id, startsAt, endsAt }`.
- **Side effect:** publishes `calendar.event.created`.

### `POST /api/events/:id/cancel`

- **Purpose:** cancel an event.
- **Auth:** user session or service token.
- **Response:** `204 No Content`.
- **Side effect:** publishes `calendar.event.cancelled`.

### `GET /api/free-slots`

- **Purpose:** find open time windows. The reason calendar exists as a callable module.
- **Caller:** any module that wants to slot a task in.
- **Auth:** service token or user session.
- **Query params:**
  - `durationMinutes` (required, integer): how long a window you need.
  - `earliest` (optional, ISO-8601): don't return slots before this. Default: now.
  - `latest` (optional, ISO-8601): don't return slots after this. Default: 7 days from now.
  - `count` (optional, integer, default 3, max 20): how many candidate slots to return.
  - `dayStart` / `dayEnd` (optional, HH:MM, default 08:00/22:00): "awake hours" — slots are constrained to this window each day.
- **Response:**
  ```json
  {
    "slots": [
      { "startsAt": "2026-05-17T14:00:00Z", "endsAt": "2026-05-17T14:30:00Z" },
      { "startsAt": "2026-05-17T18:00:00Z", "endsAt": "2026-05-17T18:30:00Z" },
      { "startsAt": "2026-05-18T09:00:00Z", "endsAt": "2026-05-18T09:30:00Z" }
    ]
  }
  ```
- **Errors:** `400` if `durationMinutes` is missing/invalid. Returns empty `slots` array (not 404) if nothing fits in the window.

Calendar **does not** auto-book on this endpoint — booking is an explicit `POST /api/events`. This separation is deliberate: the caller can show the user the options and let them pick.

### `GET /api/events`

- **Purpose:** list events (UI and dashboard).
- **Query params:** `from` / `to` (ISO-8601), `source` (optional filter).
- **Response:** `{ events: [{ id, title, notes, startsAt, endsAt, source, sourceRef, status }] }`.

### `GET /widget/next-up`

- **Purpose:** dashboard widget.
- **Response:**
  ```json
  {
    "title": "Next Up",
    "primary": "Dentist",
    "secondary": "Tomorrow at 14:00",
    "link": "/calendar"
  }
  ```
  Empty state: `primary: "Nothing scheduled"`, no secondary.

## 6. Events

### Published

| Event | Transport | When | Payload |
|---|---|---|---|
| `calendar.event.created` | pubsub | Event created | `{ id, title, startsAt, endsAt, source, sourceRef }` |
| `calendar.event.cancelled` | pubsub | Event cancelled | `{ id, source, sourceRef, cancelledAt }` |

### Subscribed

None in v0.1.

## 7. Widgets

### `next-up`

- **What it shows:** the next upcoming event within 7 days.
- **Refresh:** 300s.
- Empty state: "Nothing scheduled".

## 8. Data Ownership

```
calendar.events
  id (uuidv7), title, notes, starts_at (utc), ends_at (utc),
  source, source_ref, status ('scheduled' | 'cancelled'),
  created_by, created_at, cancelled_at
```

`source` is the module ID (or `user`) that created the event. `source_ref` is opaque — calendar never interprets it.

## 9. External Dependencies

None for v0.1.

## 10. Internal Architecture

TypeScript + Next.js, served at `/calendar`. API routes under `/calendar/api/*`. Postgres via `pg`, schema `calendar`. LC TypeScript SDK. No workers.

Single container: `calendar`.

**Slot-finding algorithm (v0.1):** in-process, naive. Query events in the requested window, sort by start time, walk gaps. Constrain to `dayStart`/`dayEnd` per local day. This is fine until the calendar has thousands of events, which won't happen for personal use. If it ever becomes slow, materialize "busy intervals" in a side table.

## 11. Failure Modes & Degradation

- **Center registry unreachable:** affects incoming service-token validation only; UI still works on cached public key.
- **A module that calls calendar misbehaves:** input is validated (duration bounds, ISO format); bad requests fail loudly. No rate limiting in v0.1.
- **Redis down — publishing:** events dropped, logged. Downstream subscribers (notifications) miss real-time cues. UI unaffected.
- **DB down:** crash + restart.

## 12. Open Questions

1. **Should `free-slots` honor a buffer between events?** ("Don't schedule back-to-back, give me 15-min breathing room.") Probably yes eventually; v0.1 ships without.
2. **Time-zone story.** UI renders local based on the user's browser. If you travel, this matters. Punted to v0.2.
3. **Conflict handling on event creation.** v0.1 allows overlapping events. Worth tightening if it becomes annoying.
4. **External sync (Google Calendar).** Two-way sync is hard; one-way pull (read-only mirror of Google events into the busy-set) is much easier and probably enough. v0.2+.

---

## Closing the Workflow

With calendar specced, the full canonical workflow is now end-to-end implementable:

1. User opens meal-picker, gets recipe suggestion.
2. Meal-picker calls `pantry POST /check` → missing ingredients identified.
3. Meal-picker calls `tasks POST /tasks` → shopping task created.
4. User opens tasks, taps "schedule" on the shopping task.
5. Tasks calls `calendar GET /free-slots?durationMinutes=30` → gets candidates.
6. User picks a slot in the UI; tasks calls `calendar POST /events`.
7. Later: user buys the items, marks task done.
8. User logs the purchase in pantry → `pantry.purchase.recorded` event fires.
9. Finance subscribes, logs the expense.
10. Pantry's inventory updates; meals' cache invalidates via `pantry.inventory.changed`.

Six modules, three synchronous calls, two events. No orchestrator in the middle. Each module owns its piece.

This is what "done enough to start building" looks like.
