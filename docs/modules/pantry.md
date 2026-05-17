# Module SRS — `pantry`

**Version:** 0.2
**Date:** 2026-05-17
**Module type:** `proxy_subpath`
**Status:** Draft — awaiting confirmation before implementation

**Changelog**
- v0.2 — Fixed health_check to full internal URL (D13); added POST /api/price-check endpoint with v0.1 unit conversion table and algorithm; resolved all three open questions (unit reconciliation, low-stock thresholds, pluralization normalization); updated meals.recipe.cooked auto-deduction to use scaled quantities and mark partial deductions.
- v0.1 — Initial draft.

---

## 1. Purpose

Pantry tracks what food and ingredients you have in stock. You log purchases, update quantities as you cook, and other modules query whether specific ingredients are available and at what price. It is for you and your girlfriend equally.

## 2. Scope

**In scope:**
- Current-inventory view: every ingredient, its quantity and unit.
- Logging purchases (manual entry for v0.1).
- Logging consumption (manual, and automatically via `meals.recipe.cooked`).
- Answering ingredient-availability queries from other modules (`/api/check`).
- Answering ingredient-pricing queries from other modules (`/api/price-check`).

**Out of scope:**
- Recipes (that's `meals`).
- Shopping lists (that's `tasks`).
- Cost tracking and reporting (that's `finance` — pantry publishes purchase events, finance subscribes).
- Expiration dates (punted to v0.2 — friction of per-item expiry entry is too high for v0.1).
- Receipt OCR (v0.2).
- Low-stock thresholds (v0.2 — configurable-per-item thresholds are a design problem; v0.1 widget shows "Fully stocked" unconditionally, see §7).

## 3. User Stories

- As me, I just got home from the store. I open pantry, hit "log purchase," and add a few items with quantities. Done in under 30 seconds.
- As me, I want to know if I have enough eggs before committing to a recipe. The meal-picker already tells me — but I can also open pantry and check directly.
- As me, I look at the pantry widget on the dashboard and see current inventory at a glance.

## 4. The Module Manifest

```yaml
id: pantry
name: Pantry
description: What's in stock, what's running low
icon: package
type: proxy_subpath
url: /pantry
internal_api: http://pantry:8000/api
health_check: http://pantry:8000/health
widgets:
  - id: low-stock
    endpoint: /widget/low-stock
    refresh_seconds: 600
events:
  publishes:
    - { name: pantry.purchase.recorded, transport: stream }
    - { name: pantry.inventory.changed, transport: pubsub }
  subscribes:
    - meals.recipe.cooked
```

`pantry.purchase.recorded` is a stream — finance cannot afford to miss these.
`pantry.inventory.changed` is pubsub — it's a cache-hint; missing one just means downstream caches stay stale a bit longer.

## 5. Public API

### `POST /api/check`

- **Purpose:** Answer "which of these ingredients do I have?"
- **Caller:** meal-picker, any future module.
- **Auth:** service token.
- **Body:** `{ "items": ["flour", "eggs", "butter"] }`
- **Response:**
  ```json
  {
    "available": ["flour"],
    "missing":   ["eggs", "butter"],
    "low":       []
  }
  ```
  `low` is always empty in v0.1 (low-stock thresholds deferred to v0.2).

**Name matching:** normalized name — lowercased, trailing `s` stripped (so "eggs" matches "egg"). Known limitation: "scallions" ≠ "green onions". Aliases planned for v0.2. If a normalized match can't be found, the item is `missing`.

### `POST /api/price-check`

- **Purpose:** Answer "what's the most recent unit price for each of these ingredients?"
- **Caller:** meals (for estimated cost on recipe detail), any future module.
- **Auth:** service token.
- **Body:**
  ```json
  {
    "items": [
      { "name": "flour", "quantity": 200, "unit": "g" }
    ]
  }
  ```
- **Response:**
  ```json
  {
    "priced": [
      {
        "name": "flour",
        "totalCost": 0.24,
        "currency": "USD",
        "unitPrice": 1.20,
        "unitPriceUnit": "kg",
        "basedOnPurchaseAt": "2026-05-10T15:00:00Z"
      }
    ],
    "unpriced": [
      { "name": "tamarind paste", "reason": "no purchase history" }
    ]
  }
  ```

**Algorithm v0.1:**
1. Normalize the item name (same as `/api/check`).
2. Find the most recent `purchases` row containing that normalized ingredient name.
3. Extract `unitPrice` and `unit` from that purchase's `items_json`.
4. If the purchase unit matches the requested unit exactly → `totalCost = unitPrice * quantity`.
5. If the units are a convertible metric pair (see conversion table below) → convert, compute cost.
6. If units are non-convertible or no purchase history exists → add to `unpriced` with the appropriate `reason`.

**v0.1 unit conversion table (exhaustive — anything not listed is unpriced):**

| From | To | Factor |
|---|---|---|
| g | kg | ÷ 1000 |
| kg | g | × 1000 |
| ml | l | ÷ 1000 |
| l | ml | × 1000 |

No other conversions (oz↔g, cup↔ml, etc.) in v0.1. Reason: non-metric conversions are ambiguous (a "cup" of flour ≠ a "cup" of oil by weight). Return `reason: "unit mismatch"` and log a warning. Defer to v0.2.

- **Errors:** `400` if `items` is missing or not an array. Otherwise always `200` (per-item failures listed in `unpriced`).

### `POST /api/purchases`

- **Purpose:** Log a purchase (UI calls this).
- **Caller:** pantry's own UI.
- **Auth:** user session.
- **Body:**
  ```json
  {
    "items": [
      { "name": "flour", "quantity": 2, "unit": "kg", "unitPrice": 1.20 }
    ],
    "totalCost": 2.40,
    "currency": "USD",
    "purchasedAt": "2026-05-16T15:00:00Z"
  }
  ```
- **Response:** `201 { purchaseId }`
- **Side effects:** upserts each item into `inventory` (add to existing quantity or create). Publishes `pantry.purchase.recorded` (stream) and `pantry.inventory.changed` (pubsub).

### `GET /api/inventory`

- **Caller:** pantry's own UI.
- **Auth:** user session.
- **Response:** `{ items: [{ id, nameDisplay, nameNormalized, quantity, unit, lastUpdated }] }` sorted by `nameDisplay`.

### `PATCH /api/inventory/:id`

- **Purpose:** Manual quantity edit (consumed something without cooking a recipe, or correction).
- **Auth:** user session.
- **Body:** `{ "quantity": 1.5 }` (absolute value, not delta).
- **Side effect:** publishes `pantry.inventory.changed` (pubsub).
- **Response:** `200 { item }`

### `GET /widget/low-stock`

- **Auth:** service token (Center).
- **Response:**
  ```json
  {
    "title": "Pantry",
    "primary": "12 items",
    "secondary": "last updated today",
    "link": "/pantry"
  }
  ```
  v0.1: shows total item count and last-updated date. Low-stock logic added in v0.2 when per-item thresholds are implemented. `primary: "Empty"` if inventory has 0 rows.

### `GET /health`

- **Response:** `200 { "ok": true }`

---

## 6. Events

### Published

| Event | Transport | When | Payload |
|---|---|---|---|
| `pantry.purchase.recorded` | stream | Purchase logged | `{ purchaseId, items: [{ name, quantity, unit, unitPrice }], totalCost, currency, purchasedAt }` |
| `pantry.inventory.changed` | pubsub | Any inventory mutation (purchase, consumption, manual edit) | `{ changedItems: ["flour", "eggs"] }` |

### Subscribed

| Event | Action | Idempotency |
|---|---|---|
| `meals.recipe.cooked` | Auto-deduct recipe ingredients from inventory (scaled to `event.data.servings`) | Check `processed_events` by `event.id` before deducting. If already processed, skip. |

**Auto-deduction rules (resolved from Q1):**
- For each ingredient in the event payload, normalize the name and find the matching inventory row.
- If no inventory row: skip, log warning.
- If inventory row exists and units match exactly OR are a convertible metric pair (same table as `/api/price-check`): deduct. Record in `consumption_log` with `source: 'recipe'`.
- If units are non-convertible: skip this ingredient. Record in `consumption_log` with `source: 'recipe-partial'` and `notes: 'unit mismatch — not deducted'`. Surface these in the pantry UI so the user can see what didn't auto-deduct.
- After all deductions, publish `pantry.inventory.changed` with the names of items that were actually updated.

---

## 7. Widgets

### `low-stock`

- **Refresh:** 600s.
- **v0.1 behaviour:** Shows total inventory count + last-updated date. The "running low" logic (thresholds) is deferred to v0.2 — widget title is intentionally generic ("Pantry") until then.
- **Empty state:** `primary: "Empty"`, no secondary, link to `/pantry`.

---

## 8. Data Ownership

Schema: `pantry`. One Postgres user `pantry` with access to `pantry` schema only.

```
pantry.inventory
  id               serial       PRIMARY KEY
  name_normalized  text         NOT NULL UNIQUE   -- lowercase, trailing-s stripped
  name_display     text         NOT NULL           -- original casing for display
  quantity         numeric(10,3) NOT NULL DEFAULT 0
  unit             text         NOT NULL
  low_stock_threshold numeric(10,3)               -- nullable; used in v0.2
  last_updated     timestamptz  NOT NULL DEFAULT NOW()

pantry.purchases
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid()
  items_json       jsonb        NOT NULL            -- [{ name, quantity, unit, unitPrice }]
  total_cost       numeric(10,2)
  currency         text         NOT NULL DEFAULT 'USD'
  purchased_at     timestamptz  NOT NULL
  user_id          text         NOT NULL
  created_at       timestamptz  NOT NULL DEFAULT NOW()

pantry.consumption_log
  id               serial       PRIMARY KEY
  name_normalized  text         NOT NULL
  quantity         numeric(10,3)
  unit             text
  source           text         NOT NULL            -- 'recipe' | 'recipe-partial' | 'manual'
  source_ref       text                             -- recipeId or purchase event.id
  notes            text                             -- e.g., "unit mismatch — not deducted"
  consumed_at      timestamptz  NOT NULL DEFAULT NOW()

pantry.processed_events
  event_id         text         PRIMARY KEY         -- UUIDv7 from event.id
  processed_at     timestamptz  NOT NULL DEFAULT NOW()
  -- idempotency table for meals.recipe.cooked subscriber
```

---

## 9. External Dependencies

None for v0.1. Future: receipt OCR API.

---

## 10. Internal Architecture

TypeScript + Next.js (App Router), served at `/pantry` via `proxy_subpath`. Same shape as `meals`. Single container `pantry`. Uses the LC TypeScript SDK for:
- `lc.verifyServiceToken()` — on `/api/check`, `/api/price-check`, widget endpoint.
- `lc.publish(...)` — `pantry.purchase.recorded` and `pantry.inventory.changed`.
- `lc.subscribe("meals.recipe.cooked", handler)` + `lc.startSubscriptions()` — auto-deduction.

No internal workers or queues. Event subscription runs in-process; the SDK's consumer group handles redelivery if the handler crashes (stream transport, not pubsub, so redelivery is guaranteed).

---

## 11. Failure Modes & Degradation

- **Redis down — publishing:** `POST /api/purchases` still succeeds (DB writes complete), but events fail to publish. v0.1 accepts this loss with a logged warning. Outbox pattern added in v0.2.
- **Redis down — subscribing:** module continues to serve UI and API. Missed `meals.recipe.cooked` events are not redelivered (gap in consumer group). v0.1 accepts this — user sees slightly stale inventory after cooking until the next manual sync.
- **Meals module down:** pantry has no dependency on meals for its own UI.
- **Postgres down:** crash + compose restart. Acceptable.
- **Auto-deduction unit mismatch:** skip silently with a `recipe-partial` log row. Don't crash or error — partial deduction is better than no deduction.

---

## 12. Open Questions

All three open questions resolved:

1. **Unit reconciliation on auto-deduct — RESOLVED.** Exact unit match OR convertible metric pair (g↔kg, ml↔l) → deduct. Anything else → skip with `recipe-partial` log. Surfaces in UI so user can see what didn't auto-deduct. See §6 for full rules.

2. **Low-stock thresholds — RESOLVED (deferred).** v0.1 ships without them. Widget shows total count, not "running low." Per-item thresholds are a v0.2 problem — the design question (configurable vs rule-based, per-item vs category-based) isn't worth answering until there's real usage data.

3. **Pluralization / synonyms — RESOLVED.** v0.1: lowercase + strip trailing `s` (e.g., "eggs" → "egg"). Known limitations: "scallions" ≠ "green onions", "1 lb chicken" won't match "chicken breast". Surface mismatches in the `recipe-partial` log and UI. Alias table planned for v0.2 once common mismatches are observed.
