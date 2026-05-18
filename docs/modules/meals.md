# Module SRS — `meals`

**Version:** 0.3
**Date:** 2026-05-19
**Module type:** `proxy_subpath`
**Status:** Deployed and operational

**Changelog**
- v0.3 — Post-deploy additions: TheMealDB integration (search, random, bulk category import); `thumbnail_url` column on `recipes`; suggestion filter pills (`?type=` URL param, `tag` param in algorithm); tag-based library filtering; ingredient fuzzy matching (descriptor stripping + substring fallback — "melted butter" → "butter"); cook-mode ingredient checklist; recipe edit UI (`PUT /api/recipes/:id` already existed, edit page now built); `POST /api/recipes/import` extended to parse Microdata/RDFa shapes; suggestion algorithm extended with `tag` filter param and staples-aware scoring (×1.3 in-stock bonus); `internal_api` corrected to `http://meals:3000/meals` (not `…/meals/api`).
- v0.2 — Major revision before build: fixed health_check to full internal URL (D13); added explicit internal_api; expanded schema (steps jsonb, has_structured_steps, difficulty, is_pinned, source_url, meal_types, cooked_log rating/notes/actual_minutes/actual_servings); added cook_sessions table; pinned suggestion algorithm (weighted random with documented multipliers, MEALS_RECENT_COOK_DAYS env var); added pin/unpin endpoints, servings scaler, estimated cost (calls pantry /api/price-check), URL import (JSON-LD schema.org), cook mode endpoints; resolved both open questions.
- v0.1 — Initial draft.

---

## 1. Purpose

Meal-picker suggests what to eat based on your tastes, what you cooked recently, and what's currently in the pantry. Given a recipe, it shows the steps, scales ingredients to any serving count, flags missing items, and estimates cost. It is for you and your girlfriend — she uses suggestions and recipes; you also manage the recipe library.

## 2. Scope

**In scope:**
- A personal recipe library with full CRUD, step-structured instructions, difficulty, tags, and meal-type tagging.
- Weighted-random suggestions filtered by recency, pantry availability, and personal ratings.
- URL import via schema.org Recipe JSON-LD parsing.
- Cook mode: timed session tracked by the backend; finish publishes the event with scaled ingredient quantities.
- Servings scaler: any recipe scaled to any serving count on request.
- Estimated ingredient cost per recipe via pantry's `/api/price-check`.
- Dashboard widget: tonight's top suggestion.

**Out of scope:**
- Tracking pantry inventory (that's `pantry`).
- Creating shopping tasks (that's `tasks` — v0.1 shows missing ingredients in the UI only).
- Logging meals to a calendar (added via events when `calendar` module exists).
- Multi-day meal planning (future sub-feature).

## 3. User Stories

- As me, I open the meal-picker on my phone, see three suggestions for tonight, tap one, and immediately see which ingredients I need to grab — with estimated cost for anything I'm missing.
- As me, I paste a recipe URL; the app pulls the title, steps, and ingredients; I review and save it in under a minute.
- As me, I mark a recipe as "made today" via cook mode — the session is timed, I rate it when I finish, and the pantry auto-deducts the ingredients.
- As me, I pin a recipe I want to cook more often and it shows up more in suggestions.
- As my girlfriend, I open the meal-picker, get suggestions, view recipes. I don't add or edit anything.

## 4. The Module Manifest

```yaml
id: meals
name: Meal Picker
description: Pick a meal, see the recipe, know what's missing
type: proxy_subpath
url: /meals
internal_api: http://meals:3000/meals
health_check: http://meals:3000/meals/health
widgets:
  - id: tonight
    endpoint: /api/widget/tonight
    refresh_seconds: 3600
events:
  publishes:
    - { name: meals.recipe.cooked, transport: stream }
  subscribes:
    - pantry.inventory.changed
```

## 5. Public API

All endpoints are under `/meals/api/*` (the Center's Next.js app routes, served via proxy_subpath).

---

### `GET /api/suggestions`

- **Caller:** meals UI (user request).
- **Auth:** user session.
- **Query params:** `count` (int, default 3), `mealType` (`breakfast|lunch|dinner`, optional), `tag` (string, optional — matches `tags` array on recipe, e.g. `dessert`, `vegetarian`).
- **Response:**
  ```json
  {
    "suggestions": [
      {
        "recipeId": "pad-thai",
        "name": "Pad Thai",
        "timeMinutes": 25,
        "difficulty": "medium",
        "missingIngredients": ["fish sauce"],
        "pantryCheckAvailable": true
      }
    ]
  }
  ```
  `missingIngredients` excludes staple items (pantry `always_available = true`) — those count as available even when quantity is 0. `pantryCheckAvailable: false` if pantry was unreachable.

**Suggestion algorithm (v0.3):**

Pool: all recipes in the library.

1. **Exclude** any recipe with a `cooked_log` entry within the last `MEALS_RECENT_COOK_DAYS` days (env var, default `7`).
2. **Filter** by `mealType` if specified — recipes must include the requested type in their `meal_types` array.
3. **Filter** by `tag` if specified — recipes must include the tag (case-insensitive) in their `tags` array.
4. If fewer than `count` recipes remain after filters, relax the recent-cook exclusion first, then relax the filters, in that order.
5. **Score** each remaining recipe:
   - Base score: 1.0
   - `is_pinned = true`: × 3.0
   - Combined pantry fraction (in-stock + staples) ≥ 80%: × 2.0; ≥ 50%: × 1.5; < 50%: × 1.0
   - **In-stock bonus:** if ≥ 50% of ingredients are physically in stock (not just staples): × 1.3. Ensures recipes with real pantry stock rank above equivalent staple-only recipes.
   - User average rating on `cooked_log` for this recipe: × (`avg_rating` / 3). Unrated = neutral (× 1.0).
6. **Weighted-random** sample `count` recipes from the scored pool.

---

### `GET /api/recipes`

- **Auth:** user session.
- **Query params:** `mealType`, `tags` (comma-separated), `difficulty`, `pinned` (bool), `q` (text search on name).
- **Response:** `{ recipes: [RecipeSummary] }` — id, name, timeMinutes, difficulty, isNew, isPinned, mealTypes, tags, cookCount, avgRating.

### `POST /api/recipes`

- **Auth:** user session (any user can add — admin not required).
- **Body:**
  ```json
  {
    "name": "Pad Thai",
    "timeMinutes": 25,
    "servingsDefault": 2,
    "difficulty": "medium",
    "mealTypes": ["dinner"],
    "tags": ["thai", "noodles"],
    "steps": [
      { "text": "Soak noodles for 30 minutes.", "durationMinutes": 30 },
      { "text": "Stir-fry everything." }
    ],
    "ingredients": [
      { "name": "rice noodles", "quantity": 200, "unit": "g" }
    ],
    "sourceUrl": "https://..."
  }
  ```
  If `steps` has > 1 entry or any step has `durationMinutes`, `has_structured_steps` is set to `true` on save.
- **Response:** `201 { recipeId }`

### `GET /api/recipes/:id`

- **Auth:** user session.
- **Query params:** `servings` (int, optional) — if provided, scales all ingredient quantities.
  - Scale formula: `scaled = round(original * (servings / servingsDefault), 2)`
- **Response:**
  ```json
  {
    "id": "pad-thai",
    "name": "Pad Thai",
    "timeMinutes": 25,
    "servingsDefault": 2,
    "servingsRequested": 4,
    "difficulty": "medium",
    "isPinned": false,
    "mealTypes": ["dinner"],
    "tags": ["thai"],
    "steps": [...],
    "ingredients": [{ "name": "rice noodles", "quantity": 400, "unit": "g" }],
    "sourceUrl": null,
    "estimatedCost": {
      "total": 6.80,
      "currency": "USD",
      "missingPriceFor": ["fish sauce"]
    },
    "cookCount": 3,
    "avgRating": 4.3
  }
  ```
  `estimatedCost` is omitted entirely if pantry is unreachable. `missingPriceFor` lists ingredients pantry couldn't price. Cost is computed on the scaled ingredient quantities if `servings` was requested.

### `PUT /api/recipes/:id`

- **Auth:** user session.
- **Body:** any subset of the POST body fields.
- **Response:** `200 { recipeId }`

### `DELETE /api/recipes/:id`

- **Response:** `204`

### `POST /api/recipes/:id/pin` / `DELETE /api/recipes/:id/pin`

- **Auth:** user session.
- Set / clear `is_pinned` on the recipe. Affects the suggestion algorithm's 3× boost.
- **Response:** `204`

### `POST /api/recipes/import`

- **Auth:** user session.
- **Body:** `{ "url": "https://..." }`
- **Behaviour:** Fetch the URL (12s timeout, browser-like UA). Parse JSON-LD, Microdata, and RDFa for `@type: "Recipe"` schema.org objects. Returns a **pre-filled but unsaved** recipe for user review. Sites behind Cloudflare/bot protection return 403 — error message tells the user to use MealDB import or add manually. `thumbnail_url` is extracted from `image` field if present.
- **Field mapping:**
  - `name` → `name`
  - `recipeYield` → `servingsDefault` (parse first integer found)
  - `totalTime` / `cookTime` → `timeMinutes` (ISO 8601 duration → minutes)
  - `recipeIngredient[]` → `ingredients` (best-effort quantity/unit parsing; unrecognized format → `{ name: raw_string, quantity: null, unit: null }`)
  - `recipeInstructions`:
    - If array of `HowToStep` with > 1 item and any `name` or `url` → structured, `has_structured_steps: true`
    - String or single-item array → single step blob, `has_structured_steps: false`
    - **Do not** auto-split blob text. Let the user manually restructure in the form.
  - `recipeCuisine` / `recipeCategory` → `tags`
  - `sourceUrl` → the original URL
- **Response on success:** `200 { recipe: { ...pre-filled fields } }` (not saved).
- **Response on parse failure:** `422 { error: "Could not parse recipe schema", pageTitle: "..." | null }`. User fills the form manually.

### `GET /api/mealdb/search` *(v0.3 — client-side only)*

TheMealDB queries are made directly from the browser (public CORS API, no server proxy needed). `lib/mealdb.ts` exports `searchMealDB(query)`, `getRandomMeal()`, `getCategories()`, `getMealsByCategory(category)`, `getMealById(id)`. Imported meals are saved via `POST /api/recipes` with the parsed fields plus `thumbnailUrl`.

---

### `POST /api/cook-sessions`

- **Auth:** user session.
- **Body:** `{ "recipeId": "pad-thai", "servings": 4 }` (`servings` defaults to recipe's `servingsDefault`).
- **Behaviour:** Creates a `cook_sessions` row with `status: "active"`. Only one active session per user at a time — returns `409` if an active session already exists.
- **Response:** `201 { sessionId, startedAt, recipe: { name, steps } }`

### `POST /api/cook-sessions/:id/finish`

- **Auth:** user session.
- **Body:** `{ "rating": 4, "notes": "Used less fish sauce", "actualServings": 3 }` (all optional).
- **Behaviour:**
  1. Sets `finished_at = now()`, `status: "completed"` on the session.
  2. Computes `actual_minutes = (finished_at - started_at)` in minutes.
  3. Creates a `cooked_log` row with `actual_minutes`, `actual_servings` (falls back to session `servings`), `rating`, `notes`.
  4. Publishes `meals.recipe.cooked` (stream) with ingredient quantities **scaled to `actual_servings`** (see §6).
- **Response:** `200 { cookedLogId, actualMinutes }`

### `POST /api/cook-sessions/:id/cancel`

- **Auth:** user session.
- **Behaviour:** Sets `status: "cancelled"` on the session. No `cooked_log` entry. No event.
- **Response:** `204`

### `GET /api/cooked-log`

- **Auth:** user session.
- **Query params:** `recipeId` (filter), `limit` (default 20).
- **Response:** `{ entries: [{ id, recipeId, recipeName, cookedAt, actualMinutes, actualServings, rating, notes }] }`

### `GET /widget/tonight`

- **Auth:** service token (Center).
- **Behaviour:** Runs the suggestion algorithm with `count=1`, no mealType filter. Returns the top result.
- **Response:**
  ```json
  {
    "title": "Tonight",
    "primary": "Pad Thai",
    "secondary": "25 min · missing 2 ingredients",
    "link": "/meals"
  }
  ```
  `secondary` omitted if pantry is unreachable. `primary: "No suggestions"`, no `secondary`, no `link` if recipe library is empty.

### `GET /health`

- **Response:** `200 { "ok": true }`

---

## 6. Events

### Published

| Event | Transport | When | Payload |
|---|---|---|---|
| `meals.recipe.cooked` | stream | Cook session finished | `{ recipeId, servings: actualServings, ingredients: [{ name, quantity: scaledQty, unit }], cookedAt, sessionId }` |

`quantity` is scaled to `actualServings` — `scaled = round(original * (actualServings / servingsDefault), 2)`. This is what pantry uses for auto-deduction. Stream because pantry and (future) finance cannot afford to miss these.

### Subscribed

| Event | Action | Idempotency |
|---|---|---|
| `pantry.inventory.changed` | Invalidate `suggestion_cache` for all users — next call to `/api/suggestions` re-checks pantry fresh | Idempotent by nature (cache delete is safe to repeat); no de-dup table needed |

---

## 7. Widgets

### `tonight`

- **Refresh:** 3600s.
- **Payload:** see `GET /widget/tonight` above.
- **Empty state:** `primary: "No suggestions"`, no secondary.
- **Error state (pantry down):** suggestion still returned, `secondary` omitted, no missing-ingredient count.

---

## 8. Data Ownership

Schema: `meals`. One Postgres user `meals` with access to `meals` schema only.

```
meals.recipes
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid()
  name             text         NOT NULL
  time_minutes     int
  servings_default int          NOT NULL DEFAULT 2
  difficulty       text         CHECK (difficulty IN ('easy','medium','hard'))
  is_pinned        boolean      NOT NULL DEFAULT false
  steps            jsonb        NOT NULL DEFAULT '[]'   -- [{ text, durationMinutes? }]
  has_structured_steps boolean  NOT NULL DEFAULT false  -- true if >1 step OR any step has durationMinutes
  ingredients      jsonb        NOT NULL DEFAULT '[]'   -- [{ name, quantity, unit }]
  meal_types       text[]       NOT NULL DEFAULT '{}'   -- breakfast | lunch | dinner
  tags             text[]       NOT NULL DEFAULT '{}'
  source_url       text
  thumbnail_url    text                               -- from MealDB or recipe URL image field
  created_by       text         NOT NULL               -- user email
  created_at       timestamptz  NOT NULL DEFAULT NOW()
  updated_at       timestamptz  NOT NULL DEFAULT NOW()

meals.cooked_log
  id               serial       PRIMARY KEY
  recipe_id        uuid         NOT NULL REFERENCES meals.recipes(id)
  user_id          text         NOT NULL
  cooked_at        timestamptz  NOT NULL DEFAULT NOW()
  actual_minutes   int                               -- from cook session timing
  actual_servings  int
  rating           int          CHECK (rating BETWEEN 1 AND 5)
  notes            text

meals.cook_sessions
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid()
  user_id          text         NOT NULL
  recipe_id        uuid         NOT NULL REFERENCES meals.recipes(id)
  servings         int          NOT NULL
  started_at       timestamptz  NOT NULL DEFAULT NOW()
  finished_at      timestamptz
  status           text         NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active','completed','cancelled'))

meals.suggestion_cache
  user_id          text         NOT NULL
  mealtime_bucket  text         NOT NULL               -- 'breakfast'|'lunch'|'dinner'|'any'
  suggestions_json jsonb        NOT NULL
  computed_at      timestamptz  NOT NULL
  PRIMARY KEY (user_id, mealtime_bucket)
```

---

## 9. External Dependencies

**Pantry module** (synchronous HTTP via SDK):
- `POST /api/check` — for ingredient availability (suggestions + recipe detail).
- `POST /api/price-check` — for estimated cost on recipe detail.
- If pantry is unreachable: degrade gracefully. Suggestions lose availability boosting. Recipe detail loses `estimatedCost`. Widget loses missing-ingredient count.

**External recipe URLs** (for import):
- Fetched once per import request, 5s timeout.
- If URL is unreachable or returns non-HTML: `422`.

---

## 10. Internal Architecture

TypeScript + Next.js (App Router), served at `/meals` via `proxy_subpath`. API routes live at `/meals/api/*` as Next.js route handlers. Database via Drizzle ORM + `postgres` npm package (same pattern as Center). Uses the LC TypeScript SDK (`@lc/sdk`) for:
- `lc.call("pantry", ...)` — ingredient check and price check.
- `lc.publish({ event: "meals.recipe.cooked", ... })` — cook session finish.
- `lc.subscribe("pantry.inventory.changed", handler)` + `lc.startSubscriptions()` — cache invalidation.

Single container `meals`. No background workers in v0.1 — all operations are request-driven.

JSON-LD parsing: use `schema-dts` types + manual extraction (no npm library is reliable enough for all schema.org Recipe flavors; a focused 50-line parser is more maintainable).

---

## 11. Failure Modes & Degradation

- **Pantry unreachable:** suggestions returned without availability boosting or `missingIngredients`. Recipe detail returned without `estimatedCost`. Widget returned without missing-ingredient count. All via `LCError` kind `unreachable` — log, degrade, never throw to the user.
- **Center registry unreachable:** SDK falls back to cached service URLs for up to 60s. After that, pantry calls fail and the above degradation applies.
- **Redis (event bus) down:** `meals.recipe.cooked` is dropped — no outbox in v0.1. Cook session still completes (DB writes succeed), user sees success. Limitation documented; add outbox if a missed event causes a real problem.
- **Postgres down:** crash, compose restarts. Acceptable.
- **Recipe import URL unreachable or non-parseable:** `422` with best-effort page title. User fills form manually.

---

## 12. Open Questions

All open questions resolved:

1. **Suppression window — RESOLVED.** 7 days default, configurable via `MEALS_RECENT_COOK_DAYS` env var. Documented in suggestion algorithm above.
2. **Event payload scaling — RESOLVED.** `meals.recipe.cooked` uses `actual_servings` (from cook session) to scale all ingredient quantities. Formula: `round(original * (actual_servings / servings_default), 2)`. Pantry sees the right amounts for auto-deduction.
