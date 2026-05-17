# Module SRS — `finance`

**Version:** 0.1
**Date:** May 2026
**Module type:** `linked`
**Status:** Draft (integration spec for an existing external app)

> Note: finance is your existing app, deployed separately. This document specifies only the *integration surface* — what the app exposes to the Center, not how the app itself works internally.

## 1. Purpose

Personal finance tracking for you and your girlfriend. Categorizes expenses, tracks balances, generates reports. Already built, runs on its own. The Center integrates it as a launcher entry, a dashboard widget, and optionally an event subscriber.

## 2. Scope (of this integration spec)

**In scope (integration surface):**
- A launcher entry in the Center.
- A widget on the dashboard showing current month spend / running balance.
- A subscription to `pantry.purchase.recorded` events so grocery spending is automatically logged.

**Out of scope:**
- Anything about how finance works internally — that's finance's own problem.
- Two-way sync with the Center beyond the above.
- Authentication unification — for v0.1, finance maintains its own login. Single sign-on across both is a v0.2+ problem (see §12).

## 3. User Stories

- As me, I tap the Finance tile in the Center launcher → it opens in a new tab to my existing finance app.
- As me, I glance at the dashboard and see "This month: $1,240" without having to open finance at all.
- As me, when I log a grocery purchase in pantry, the expense appears in finance automatically (categorized as "groceries").

## 4. The Module Manifest

```yaml
id: finance
name: Finance
description: Spending and balances
icon: wallet
type: linked
url: https://finance.mydomain.tld
internal_api: https://finance.mydomain.tld/api
health_check: https://finance.mydomain.tld/api/health
widgets:
  - id: month-spend
    endpoint: /widget/month-spend
    refresh_seconds: 1800
events:
  publishes: []
  subscribes:
    - pantry.purchase.recorded
```

Notable: `internal_api` is an HTTPS URL on the public-ish domain, not a Docker-network address. The finance app sits outside the Center's compose network — it's a different deployment entirely. The Center's widget poller reaches it over the public internet (or a tailnet, if you set one up).

Service tokens still work — the Center signs them, finance's `/widget` endpoint validates them. The transport just happens to be HTTPS-over-internet instead of HTTP-over-docker-network.

## 5. Public API

Only the integration endpoints are specified here.

### `GET /widget/month-spend`

- **Purpose:** dashboard widget.
- **Caller:** Center widget poller.
- **Auth:** service token (with `aud: finance`).
- **Response:**
  ```json
  {
    "title": "This Month",
    "primary": "$1,240",
    "secondary": "$420 over avg",
    "link": "https://finance.mydomain.tld/dashboard"
  }
  ```
- **Errors:** 500 returns last-cached value on the Center side; widget shows stale-indicator.

### `GET /api/health`

- **Purpose:** health check for the Center registry.
- **Auth:** none.
- **Response:** `200 OK` with `{ status: "ok" }`.

That's the entire integration surface. The rest of finance's API is finance's business.

## 6. Events

### Published

None — finance doesn't push anything into the Center's event bus in v0.1.

### Subscribed

| Event | Action | Idempotency |
|---|---|---|
| `pantry.purchase.recorded` | Create an expense entry in finance, category "groceries", with the purchase's `totalCost` and item descriptions | Track processed `event.id`s in finance's own `processed_events` table; skip duplicates |

**Important:** finance needs to be on the same Redis (or have access to it) to subscribe. For v0.1, this means finance needs network access to the Center's Redis. Two options:
- Run finance on the same host and join the Docker network. Cleanest.
- Run finance elsewhere and expose Redis through a tunnel (Tailscale, WireGuard). Works but adds moving parts.

Recommend option 1: rehosting finance into the same compose stack, even though it's a separate app. The Center's compose is just a glue layer — finance's containers can sit alongside without sharing anything else.

## 7. Widgets

### `month-spend`

- See §5. Refreshes every 30 minutes — finance data doesn't change that fast.
- Empty state (e.g., first day of month): `primary: "$0"`, no secondary.

## 8. Data Ownership

Finance owns all of its data in whatever schema/DB it already uses. The Center's `center` schema only stores the manifest entry. There is no Center-side mirror of finance data.

## 9. External Dependencies

Whatever finance already depends on — bank APIs, exchange-rate services, etc. None of those are the Center's concern.

## 10. Internal Architecture

Whatever finance is built with. The integration only requires finance to add:
- The `/widget/month-spend` endpoint.
- The `/api/health` endpoint (probably already exists).
- A Redis subscription handler for `pantry.purchase.recorded`.
- JWT verification middleware on the widget endpoint (Center's public key, audience = `finance`).

If finance is in a language without an LC SDK yet, the verification logic is short enough to inline — see §10 of the SDK design doc for the verification algorithm.

## 11. Failure Modes & Degradation

- **Finance app down:** widget shows last-cached value with a stale indicator. Launcher tile shows red health-check dot.
- **Center widget poller can't reach finance:** same as above. Finance's UI is unaffected — users can still open it directly via the linked URL.
- **Redis down:** finance can't receive `pantry.purchase.recorded` events. They are lost (no outbox on either side in v0.1). User can manually log the expense if it matters.
- **JWT verification fails:** widget endpoint returns 401, Center logs it, widget shows error state. Usually means a clock skew issue or key rotation that didn't propagate.

## 12. Open Questions

1. **Auth unification.** Right now finance has its own login; the user logs into the Center *and* into finance separately. Adding OIDC to finance (consuming the Center's auth provider) would unify the experience. Worth doing in v0.2, not v0.1.
2. **Reverse direction: should finance push events?** "Budget exceeded" or "unusual spend detected" could be useful events. Decide once you've used the current integration for a month.
3. **Grocery categorization fidelity.** When pantry.purchase.recorded arrives, do we categorize the entire purchase as "groceries"? What if it included non-grocery items? v0.1 ships dumb (everything = groceries); user manually re-categorizes if needed. Pantry could grow per-item categories in v0.2.
