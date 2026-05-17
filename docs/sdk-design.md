# Laziness Center — Inter-Module Client SDK Design

**Version:** 0.2
**Status:** Design reference for Phase 3 implementation
**Scope:** The client library every module uses to talk to other modules and to the event bus.

**Changelog**
- v0.2 — Surfaced after meal+pantry spec: pinned UUIDv7 for `event.id`, documented the outbox pattern as a future option, pinned JWT claims (iss/sub/aud/iat/exp/jti), made audience verification explicit in `verifyServiceToken` with stepped algorithm.
- v0.1 — Initial design.

---

## 1. Purpose

Every module — whether TypeScript, Go, or Python — needs to do the same handful of things when interacting with the rest of the system:

1. Find another module's API URL (service discovery).
2. Authenticate when calling that module (service tokens).
3. Make a resilient HTTP call (timeout, retry, graceful failure).
4. Publish events.
5. Subscribe to events.
6. Verify incoming inter-module requests.

Without a shared SDK, every module reinvents these patterns slightly differently, they drift, and bugs accumulate at the seams. The SDK is the contract layer made executable.

## 2. Design Principles

- **Thin, not magical.** The SDK is a wrapper around HTTP and Redis. It is not a framework, not a DI container, not an ORM. A developer should be able to read its source in one sitting.
- **One SDK per language, identical surface.** TypeScript, Go, Python — same method names, same semantics, same error shapes. A module written in Python should feel like a module written in Go to anyone reading either codebase.
- **Fail loud, degrade quiet.** Configuration errors (missing env vars, bad signing key) crash at startup. Runtime failures (callee timeout, event-bus disconnect) return errors the caller chooses how to handle.
- **No hidden state.** Every SDK call takes its dependencies explicitly. No singletons, no global registries the user can't see.
- **Cached service discovery.** The Center is the source of truth, but the SDK caches discoveries for 60s. Restarting one module shouldn't cause a thundering herd against the registry.

## 3. The SDK Surface

The TypeScript surface is the reference. Go and Python mirror it idiomatically.

### 3.1 Initialization

```typescript
import { LCClient } from '@lc/sdk';

const lc = new LCClient({
  moduleId: 'meals',                          // who am I
  centerUrl: process.env.CENTER_INTERNAL_URL, // http://center:3000/internal
  redisUrl:  process.env.REDIS_URL,           // shared event bus
  // optional:
  serviceCacheTtl: 60,                        // seconds; default 60
  defaultTimeout: 3000,                       // ms; default 3000
  logger: myLogger,                           // any { info, warn, error } shape
});
```

One client per module process. Modules MUST NOT create multiple clients — the cache and connection pools are per-instance.

### 3.2 Calling Another Module

```typescript
// Simple call. Returns parsed JSON.
const pantry = await lc.call('pantry', {
  method: 'POST',
  path: '/check',
  body: { items: ['flour', 'eggs', 'butter'] },
});
// pantry: { available: ['flour'], missing: ['eggs', 'butter'] }

// With overrides:
const tasks = await lc.call('tasks', {
  method: 'POST',
  path: '/tasks',
  body: { title: 'Buy eggs and butter' },
  timeoutMs: 5000,
  retries: 0,        // default is 0; opt-in only
});
```

**What `call` does under the hood:**

1. Looks up `pantry` in the service cache. Cache miss → fetches `GET {centerUrl}/registry/services/pantry` → caches the `base_url`.
2. Requests a service token: `POST {centerUrl}/internal/token`, body `{ target: 'pantry' }`. Receives a JWT with the following claims:
   - `iss`: `lc-center`
   - `sub`: the calling module's ID (e.g., `meals`) — this is what the callee sees as `req.lcCaller`
   - `aud`: the target module's ID **exactly** (e.g., `pantry`) — used for audience verification on the receiving end
   - `iat`, `exp`: standard, with a 5-minute TTL
   - `jti`: unique token ID for revocation tracking
3. Sends `POST {pantry.base_url}/check` with header `Authorization: Bearer <jwt>` and body JSON.
4. Applies the timeout. On timeout/network error: throws `LCError` of kind `unreachable` after any configured retries.
5. On 4xx: throws `LCError` of kind `client_error` (no retry).
6. On 5xx: throws `LCError` of kind `server_error` (retried if `retries > 0`, with exponential backoff: 100ms, 400ms, 1.6s).
7. On success: returns parsed JSON.

**Service tokens are cached** until 30 seconds before expiry, per `(source, target)` pair. The user never sees them.

### 3.3 The `LCError` Shape

Every failure path throws or returns the same error type:

```typescript
class LCError extends Error {
  kind:        'unreachable'    // network failure, timeout, DNS
             | 'unauthorized'   // 401/403 from callee — token rejected
             | 'not_found'      // 404 from callee
             | 'client_error'   // any other 4xx
             | 'server_error'   // any 5xx
             | 'discovery_failed' // Center couldn't resolve the target
             | 'config'         // SDK misconfigured (caught at startup)
             ;
  target?:     string;          // which module we were calling
  status?:     number;          // HTTP status if applicable
  retryable:   boolean;         // whether retrying would plausibly help
  cause?:      unknown;         // underlying error
}
```

Callers pattern-match on `kind`. Most code only cares about `unreachable` vs `server_error` (degrade gracefully) vs `client_error` (a real bug to fix).

### 3.4 Publishing Events

```typescript
await lc.publish({
  event: 'meals.cooking.started',
  data: { recipeId: 'pad-thai', servings: 2 },
});
// id, version, ts, source_module filled in by the SDK
```

The SDK looks up the event in the module's manifest at startup to determine `transport` (pubsub vs stream). Publishing an event not declared in the manifest is a **startup-time error** if strict mode is on (default), or a warning logged if off. This forces the manifest to stay accurate.

**The `id` field** is a UUIDv7 generated at publish time, included in the payload, and stable across stream redeliveries. Subscribers use it as the de-duplication key. UUIDv7 (not v4) because the embedded timestamp makes it sortable and cheap to expire from idempotency tables.

**Outbox pattern (not in v0.1, documented for when you need it).** If a module loses events when Redis is unreachable, the pattern is:
1. In the same DB transaction as your business write, insert a row into a local `outbox` table: `(id, event, payload, created_at, published_at NULL)`.
2. A small background loop in the same module process polls the outbox for unpublished rows, attempts to `publish` them, and marks them published on success.
3. On crash/restart, unpublished rows are simply retried.

Add this only when an actually-lost event matters. Most events in this system don't.

### 3.5 Subscribing to Events

```typescript
lc.subscribe('pantry.purchase.recorded', async (event) => {
  // event: { event, version, ts, source_module, data }
  await updateKnownInventory(event.data.items);
});

await lc.startSubscriptions(); // begins consuming after all handlers registered
```

For **Pub/Sub** events: handlers are called best-effort. If the handler throws, the event is logged and dropped.

For **Stream** events: the SDK uses Redis consumer groups, with the group name being the subscribing module's ID. Handlers must return successfully to ack; throwing causes redelivery (up to 5 times, then routed to a per-module dead-letter list `lc:dlq:{moduleId}`).

**Idempotency is the handler's responsibility.** The SDK provides `event.id` (a unique ID per event delivery) which handlers can de-duplicate against if they want.

### 3.6 Verifying Incoming Requests

When a module's HTTP handler receives a request from another module, it needs to verify the JWT. The SDK provides middleware:

```typescript
// Express example
app.use('/api', lc.verifyServiceToken());

app.post('/check', (req, res) => {
  // req.lcCaller = 'meals'  -- guaranteed by middleware
  // ...
});
```

For non-Express stacks, the underlying primitive is exposed:

```typescript
const result = lc.verifyToken(authHeader);
// { ok: true, caller: 'meals' } or { ok: false, reason: '...' }
```

**`verifyServiceToken` MUST check the audience.** The token's `aud` claim must match the verifying module's own `moduleId`. A token minted for module A is not valid against module B even if both trust the Center's signing key. Without this check, a compromised module could replay its tokens against other modules. The SDK enforces this automatically — modules cannot accidentally skip it.

Verification steps the SDK performs in order:
1. Extract bearer token from `Authorization` header. Missing/malformed → `unauthorized`.
2. Verify signature with Center's public key (cached). Failure → `unauthorized`.
3. Check `iss == "lc-center"`. Mismatch → `unauthorized`.
4. Check `aud == this.moduleId`. Mismatch → `unauthorized`.
5. Check `exp` is in the future. Expired → `unauthorized`.
6. Check `jti` against revocation list (cached from Center every 60s). Revoked → `unauthorized`.
7. Attach `caller = sub` to the request and proceed.

User requests (forwarded from the reverse proxy with auth headers) are handled separately — they have a different middleware (`lc.verifyUser()`) that reads the proxy's user headers. The two never overlap; a request is either a user request or a service request.

## 4. Manifest Integration

The SDK reads the module's own manifest at startup to:
- Know its own `moduleId` (cross-check against the env var; fail if mismatch).
- Load `events.publishes` for transport routing.
- Load `events.subscribes` for handler validation.

The manifest path is `LC_MANIFEST_PATH` env var, defaulting to `/etc/lc/manifest.yaml`.

## 5. Configuration

Every module process receives these env vars from the Center's deployment:

| Var | Purpose |
|---|---|
| `LC_MODULE_ID` | Module's declared ID. Used by the SDK to identify itself. |
| `CENTER_INTERNAL_URL` | Base URL for the Center's internal API on the Docker network. |
| `REDIS_URL` | Shared event bus. |
| `LC_MANIFEST_PATH` | Path to this module's manifest. |
| `LC_LOG_LEVEL` | `debug` / `info` / `warn` / `error`. |
| `LC_STRICT_EVENTS` | `true` (default) — fail to publish undeclared events. |

The Center reads each module's manifest and injects the right values via the compose file. Modules don't compose their own env.

## 6. Cross-Language Parity

Every language SDK provides the same surface:

| TS                                  | Go                                  | Python                                |
|---|---|---|
| `new LCClient(opts)`                | `lc.New(opts)`                      | `LCClient(**opts)`                    |
| `lc.call(target, opts)`             | `lc.Call(ctx, target, opts)`        | `await lc.call(target, **opts)`       |
| `lc.publish(event)`                 | `lc.Publish(ctx, event)`            | `await lc.publish(event)`             |
| `lc.subscribe(name, handler)`       | `lc.Subscribe(name, handler)`       | `lc.subscribe(name)(handler)` (decorator) |
| `lc.verifyServiceToken()` middleware | `lc.VerifyServiceToken()` middleware | `lc.verify_service_token` dependency  |

The error type is mirrored: TS `LCError`, Go `lc.Error` struct, Python `LCError` exception. All with the same `kind` enum.

## 7. What the SDK Deliberately Doesn't Do

To keep it thin:

- **No retries by default.** The caller opts in per call.
- **No circuit breakers.** Down modules are detected via health checks at the Center; the SDK doesn't try to be clever about it. If you call a down module, you get `unreachable` and you handle it.
- **No tracing/metrics integration.** It logs structured JSON to stdout. If you want OpenTelemetry, you bolt it on at the HTTP layer outside the SDK. (This may change once observability becomes a felt need.)
- **No request/response schema validation.** Modules validate their own inputs and outputs. The SDK just moves JSON.
- **No queueing.** If Redis is down, `publish` throws. The SDK does not buffer events. (Modules that need durability under bus outages should write to their own DB first, then publish — outbox pattern.)
- **No background polling of `health_check`.** That's the Center's job.

## 8. Implementation Phasing

To avoid blocking real modules on a complete SDK:

**v0.1 (minimum to unblock Phase 3):**
- TypeScript SDK only.
- `call`, `verifyServiceToken`, `publish`, `subscribe` (pub/sub only — no streams yet).
- Service discovery with 60s TTL.
- JWT minting and verification.

**v0.2 (when the first stream-event use case lands):**
- Redis Streams support with consumer groups.
- Dead-letter list.

**v0.3 (when you write your first Go or Python module):**
- Port the SDK to that language.
- The reference doc (this file) becomes the language-neutral spec; each implementation has its own README.

## 9. Open Questions

1. **Health probes from the SDK.** Should the SDK expose `lc.healthcheck()` so modules implement `/health` in one line? Probably yes — it's tiny and ensures consistency. Add in v0.1.
2. **In-memory event handler ordering.** If a module subscribes to two events that may both fire from one upstream action, ordering is not guaranteed. Worth documenting per-handler if it matters; the SDK won't try to coordinate.
3. **Schema validation hooks.** When a published event payload is wrong shape, we currently fail open (the payload goes out). A v1.x feature might let modules register zod/pydantic schemas per event for validation. Decide when it becomes a real bug.

---

This doc evolves as the first real cross-module integration (meal + pantry) surfaces gaps. Treat anything here as provisional until that integration validates it.
