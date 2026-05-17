# Module SRS — `<module-id>`

**Version:** 0.1
**Date:** YYYY-MM-DD
**Module type:** `proxy_subpath` | `iframe` | `linked`
**Status:** Draft / In Development / Live

> A module SRS is shorter than the Center SRS — modules are leaves, not hubs. The goal is a one-screen-scrollable document that captures everything a future-you needs to remember why this module exists and how it talks to the world.

---

## 1. Purpose

One paragraph. What does this module do, for whom (you / both), and what problem does it solve? If you can't write this in 3–4 sentences, the module is doing too much — split it.

## 2. Scope

- **In scope:** the things this module owns.
- **Out of scope:** the things people might *think* this module owns but doesn't. Be explicit. Example for meal-picker: "Inventory tracking is out of scope — that's the pantry module."

## 3. User Stories

Three to five concrete stories. Phrased as "As me, I want…" and ending with the observable outcome. Skip abstract personas.

- As me, I…
- As me, I…

## 4. The Module Manifest

The actual YAML that will land in the registry. Treated as part of the spec because changing it changes the contract.

```yaml
id: <module-id>
name: <Human Readable Name>
description: <one-line>
icon: <lucide-icon-name>
type: <proxy_subpath | iframe | linked>
url: <subpath or absolute URL>
internal_api: <http://service:port/api>      # if other modules call this one
health_check: <path or URL>
default_hidden:                              # optional
  - <user-id>
widgets:                                     # optional
  - id: <widget-id>
    endpoint: /widget/<name>
    refresh_seconds: <int>
events:                                      # optional
  publishes:
    - { name: <module>.<thing>.<verb>, transport: <pubsub|stream> }
  subscribes:
    - <module>.<thing>.<verb>
```

## 5. Public API

Every endpoint other modules (or the Center's dashboard) may call. **Internal endpoints (used only by this module's own UI) are not specified here** — those are an implementation detail.

For each endpoint:

### `<METHOD> <path>`

- **Purpose:** one line.
- **Caller(s):** which modules call this. ("Center widget poller", "meal-picker", "any module".)
- **Auth:** user session | service token | either.
- **Request body / query params:** JSON shape with field types and which are required.
- **Response body:** JSON shape on success.
- **Errors:** non-obvious failure modes and their HTTP codes.

Repeat per endpoint. Aim for fewer than 8 endpoints — if you have more, the module is probably doing too much.

## 6. Events

### Published

| Event name | Transport | When it fires | Payload shape |
|---|---|---|---|
| `<name>` | pubsub/stream | <trigger> | `{ ... }` |

### Subscribed

| Event name | What this module does on receipt | Idempotency strategy |
|---|---|---|
| `<name>` | <action> | <how dupes are handled> |

If empty, omit the section.

## 7. Widgets

For each widget declared in the manifest:

### `<widget-id>`

- **What it shows:** one line.
- **Refresh interval:** seconds (must match manifest).
- **Payload shape:** the JSON returned. Follows the Center's widget contract — `{ title, primary, secondary?, sparkline?, link? }`.
- **Empty/error state:** what the widget shows when the module has no data or errors.

If empty, omit the section.

## 8. Data Ownership

What this module stores in its Postgres schema. Sketch level, not full DDL.

```
<schema>.<table>
  <fields, with the key ones called out>

<schema>.<table>
  ...
```

Note any data this module *references but does not own* (e.g., "stores `recipeId` from meal-picker, treated as opaque").

## 9. External Dependencies

Anything outside the system this module talks to: APIs, scrapers, third-party services, files on disk. For each:

- What it is.
- What happens when it's unavailable. (Crash? Degrade? Cache?)
- Rate limits / cost considerations if any.

If empty (pure internal module), omit.

## 10. Internal Architecture (Brief)

One paragraph. Language, framework, notable architectural choices (workers, queues, headless browsers, etc.). Not a tutorial — just enough to orient a new reader.

If the module has internal infrastructure (queues, workers, separate Redis), list the containers it adds to compose.

## 11. Failure Modes & Degradation

Walk through each dependency and state what this module does when it fails. Be specific — "graceful degradation" without a description is a lie.

- **Center registry unreachable:** can this module still serve its UI? Can it still serve cached service-discovery results? (Default: yes, for `serviceCacheTtl`.)
- **A module this one calls is down:** what does the caller see? Stale cache? Partial response with an "unavailable" flag? Hard error? Be specific per called module if behaviors differ.
- **A module that calls this one is misbehaving:** rate-limiting? Validation? Or do you trust all callers because they're all yours? (Usually the latter for v0.1.)
- **Redis (event bus) down — publishing:** event lost (logged warning), or outbox pattern? Note that v0.1 modules generally accept event loss.
- **Redis (event bus) down — subscribing:** module continues to serve its own UI/API, just doesn't react to events. SDK should auto-reconnect.
- **This module's DB down:** usually crash + compose restart. Acceptable.
- **External API down (if applicable):** cache last-good response? Hard fail? User-visible error?
- **Disk full / out of memory:** out of scope unless this module is unusual.

## 12. Open Questions

Issues this spec hasn't resolved. Each should have an owner-of-the-answer (usually you) and a trigger that forces resolution (e.g., "decide when first user other than me uses it").

---

## Module SRS Template — Notes on Use

- **First draft is small.** Don't write all 12 sections before code exists. Write 1–4, 7, and 10. The rest fills in as the module takes shape.
- **The manifest in §4 is the spec.** If the YAML changes, this doc changes. If they drift, the doc loses authority.
- **Stay below ~150 lines.** A module SRS that exceeds two screens of scrolling is a sign the module is too big.
- **§11 (failure modes) is the most-skipped and most-valuable section.** Force yourself to fill it in before declaring the module "Live."
- **Template version:** 0.2 (§11 expanded with explicit dependency-by-dependency failure prompts after meal+pantry exposed the need for them).
