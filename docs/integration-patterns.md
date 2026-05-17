# Cross-Module Integration Patterns

> Distilled from the meal+pantry and tasks+finance pair specs. These are the patterns every new module should follow.

## From meal + pantry

1. **Synchronous calls are for "I can't proceed without this answer."** Meal-picker needs the pantry check to render suggestions. There's no way to do that asynchronously without making the UX worse.
2. **Events are for "I did a thing, others may react."** Both modules publish events that other modules (current or future) consume. Neither has a hard dependency on any subscriber existing.
3. **Failure isolation in practice.** If pantry is down, meal-picker still works (without the missing-ingredients data). If meals is down, pantry still works (just no auto-deduct from cooking). Each module's failure mode degrades the system, never breaks it.
4. **Idempotency lives in the subscriber.** Pantry's `processed_events` table is the canonical pattern. Every event-consuming module follows it.
5. **The Center is not involved in the workflow.** It hosts both modules, mints JWTs for inter-module calls, routes events through its Redis — but it does not coordinate the meal-pantry interaction. This is "Center has no business logic" in practice.

## From tasks + finance

6. **`linked` modules can still participate in everything.** Finance lives in a different deployment, has its own auth and data, was built before the Center existed — and still surfaces widgets, subscribes to events, and verifies service tokens. Contracts are the same; only the transport differs (HTTPS vs Docker DNS).
7. **Cross-cutting modules earn their keep through narrow APIs.** Tasks could have grown a sprawling API anticipating every caller's needs. It didn't — five endpoints, one optional `sourceRef`, no opinions about what tasks "mean." That restraint is what lets every other module use it without ceremony.
8. **Source attribution is essential.** Every task knows which module created it (`source` field) and how to find itself again (`sourceRef`). Without this, tasks would be a garbage drawer.
9. **Auth heterogeneity is fine.** Finance has its own login. The Center's SSO doesn't reach it yet. Don't let the perfect SSO story block a working integration — unify auth in v0.2.

## Currency handling

10. **Store currency alongside every monetary value; never assume a default.** Every table that records a monetary amount must include a `currency` column. The system default is `'RWF'` (Rwanda franc). Code that falls back to a hardcoded currency string is a bug.
11. **Display formatting respects the user's currency preference.** Use `Intl.NumberFormat` with the currency code from the data, not a hardcoded symbol. Example: `new Intl.NumberFormat('en-RW', { style: 'currency', currency: row.currency }).format(amount)`.
12. **The Center does not perform FX conversion.** If a widget receives data recorded in a different currency than the user's preference, display the source currency as-is. Never silently convert. Conversion is out of scope until there is a concrete need and a reliable FX data source.
13. **Module top-bar integration requires 44px top padding.** Any `proxy_subpath` module that includes the shared Center top-bar shim (`/chrome/topbar.js`) must ensure its body has at least 44px of top padding so content is not hidden behind the bar.

## The canonical workflow

End-to-end, exercising all the patterns:

1. User opens meal-picker, gets recipe suggestion.
2. Meal-picker calls `pantry POST /check` → missing ingredients identified.
3. Meal-picker calls `tasks POST /tasks` → shopping task created.
4. User opens tasks, taps "schedule" on the shopping task.
5. Tasks calls `calendar GET /free-slots?durationMinutes=30` → candidates returned.
6. User picks a slot; tasks calls `calendar POST /events`.
7. User buys items, marks task done.
8. User logs purchase in pantry → `pantry.purchase.recorded` fires.
9. Finance subscribes, logs the expense.
10. Pantry's inventory updates; meals' cache invalidates via `pantry.inventory.changed`.

Six modules, three synchronous calls, two events. No orchestrator in the middle.
