# CLAUDE.md — Laziness Center

You are working on a self-hosted personal webapp called the **Laziness Center** — a hub that surfaces a growing set of personal utility modules (meal picker, pantry, tasks, calendar, finance, manhwa parser, AliExpress bot, etc.) behind one URL with one identity.

This file is your standing brief. Read it first, every session. Read `STATUS.md` second to see where the project is right now.

---

## 1. What This Project Is

A self-hosted modular webapp where the "Center" is a thin shell — auth, dashboard, launcher, service discovery, event bus — and every actual utility is a **module** with its own container, language, and lifecycle. The Center never contains business logic; modules own their domains.

The architecture, contracts, and conventions are specified in detail under `docs/`. **Do not re-derive them. Read them.**

## 2. Where to Find Things

```
docs/
  center-srs.md             # The Center itself — architecture, contracts, phased rollout.
  sdk-design.md             # Inter-module client SDK spec (TS reference surface).
  module-srs-template.md    # Template for new module specs. Use this verbatim.
  integration-patterns.md   # Cross-module patterns distilled from the first two pairs.
  modules/
    meals.md                # First canonical pair (with pantry)
    pantry.md
    tasks.md                # Cross-cutting work queue
    finance.md              # External `linked` module integration spec
    calendar.md             # Closes the canonical workflow
  decisions/
    README.md               # How to write ADRs. Create one per significant decision.
    NNNN-title.md           # Numbered ADRs as you make decisions.

STATUS.md                   # Living progress log. Update every meaningful session.
CLAUDE.md                   # This file.
```

**Read the docs in this order on first session:** `center-srs.md` → `sdk-design.md` → `integration-patterns.md` → `module-srs-template.md` → the module specs (in any order). Then `STATUS.md` to see where work currently stands.

## 3. The Hardest Rules (don't break these)

Everything in the specs matters, but these are the ones whose violation will silently corrupt the architecture:

1. **The Center has no business logic.** If it's about meals, money, manhwa, or tasks — it belongs in a module. The Center hosts, routes, aggregates, authenticates, and discovers. That's all.
2. **Workflow orchestration lives in the originating module.** When the meal-picker needs to check the pantry, create a task, and book a calendar slot, that orchestration sits inside the meal module's code. The Center is never the conductor.
3. **No cross-schema foreign keys.** Each module owns its Postgres schema. If module A needs to reference data owned by B, store the ID as opaque and resolve via B's API. Foreign keys couple modules at the DB level and defeat modularity.
4. **Module-internal infrastructure (workers, queues, scrapers) stays inside the module.** The shared Redis is for Center-owned concerns (sessions, event bus). Module-internal queues run in the module's own container group.
5. **Manifest is the spec.** Every module has a YAML manifest. If you change a module's API, events, or widget contract, you change the manifest in the same commit. They never drift.
6. **Idempotency lives in subscribers.** Event subscribers de-duplicate using `event.id` (UUIDv7) against a per-module `processed_events` table. This is non-negotiable for stream events.
7. **Service-token audience check is mandatory.** Every inbound service-to-service request verifies the JWT's `aud` claim equals the receiving module's ID. Skipping this allows token replay across modules.

## 4. Tech Stack (Pinned)

- **Center & first-party modules:** Next.js (App Router) + TypeScript + Tailwind.
- **Database:** PostgreSQL 16, one instance, schema-per-module, user-per-module.
- **Cache / Event bus:** Redis (single shared instance, Center-owned).
- **Auth:** Authelia or Pocket-ID (self-hosted OIDC) + forward-auth at the reverse proxy.
- **Reverse proxy:** Caddy.
- **Orchestration:** Docker Compose, single host.
- **Secrets:** SOPS + age.

Modules can use other languages (Go for high-concurrency scrapers, Python for ML-flavored work) — they only need to speak HTTP+JSON and Redis events. Don't introduce new core dependencies without an ADR.

## 5. Build Order (from `center-srs.md` §7)

This is the phased rollout. Don't skip ahead.

- **Phase 0:** Foundation — domain, reverse proxy + TLS, auth provider, empty Center app, Postgres + Redis, docker-compose.
- **Phase 1:** Module plumbing — manifest loader, registry CRUD, launcher, health checks.
- **Phase 2:** Dashboard — widget contract, demo widgets, layout persistence.
- **Phase 3:** Inter-module communication — service discovery endpoint, JWT minting, TS SDK v0.1, event bus wiring. **Lock the contracts before any real module depends on them.**
- **Phase 4:** First real module (the easy one — pick manhwa parser or similar).
- **Phase 5:** First cross-module workflow (meal + pantry — the canonical pair).
- **Phase 6:** External `linked` module (finance).
- **Phase 7:** Polish — PWA, notifications, command palette, mobile pass.
- **Phase 8+:** Add modules as inspiration strikes.

You are currently at the phase recorded in `STATUS.md` under "Current Phase." Always confirm before starting a new phase.

## 6. How to Behave in This Repo

- **Read before writing.** New session = re-read `STATUS.md` and any spec you're about to touch.
- **Manifest first.** Building a new module? Write the manifest and the SRS first (using `docs/module-srs-template.md`), get user confirmation, then code.
- **Small commits with clear messages.** One concept per commit. Future you needs to bisect.
- **Tests where they earn their keep.** Definitely on the SDK, on auth flows, on the manifest loader. Probably not on every CRUD endpoint of every module — personal project, single user.
- **Ask before doing speculative work.** If a spec is ambiguous, ask the user, don't guess and ship.
- **Flag drift, don't paper over it.** If reality diverges from a spec, say so clearly and propose an update.
- **Mobile-first when touching UI.** Build on a 375px viewport first.

## 7. ⚠️ DOC MAINTENANCE — READ THIS, IT IS NOT OPTIONAL

The single biggest risk to this project is the docs drifting from the code. If that happens, the user has to re-explain context every session and the architectural rules erode. **Updating the docs is part of every task, not a follow-up.**

### After every meaningful session, update `STATUS.md`:

This means: anything beyond a typo fix. Implementing a feature, finishing a phase, making a decision, hitting a blocker, changing a contract — all require a `STATUS.md` update **in the same session, before you stop**.

The structure to maintain in `STATUS.md`:

```
## Current Phase
(Which phase from §5 above. One line.)

## Last Session Summary
(2–5 bullets. What was actually done.)

## What's Built and Working
(Running list. Add as things land. Each item: one line.)

## What's In Progress
(Things partially done. Each: one line + branch/file pointer.)

## Open Questions for the User
(Things you need a human decision on. Resolve and clear these.)

## Recent Decisions
(Pointer to the latest ADRs in docs/decisions/ — 3-5 most recent.)

## Known Issues / Tech Debt
(Things that work but should be revisited. Be honest.)
```

### When you make an architectural decision, write an ADR:

Architectural decision = anything the user would want to know the reasoning for six months from now. Examples: choosing a JWT library, deciding how the manifest watcher works, picking the iframe height protocol, etc.

ADRs live in `docs/decisions/NNNN-title.md` using the format in `docs/decisions/README.md`. Number sequentially. **Never edit an ADR after it's accepted** — supersede with a new one if the decision changes.

### When you change a spec, update the spec doc:

- Adding a manifest field? Update `center-srs.md` §4.3 and the module's own SRS.
- Changing the SDK surface? Update `sdk-design.md` and bump its version.
- Adding a new module? Create `docs/modules/<name>.md` from the template.
- Discovered a spec gap during implementation? Update the spec, note it in the commit message, mention it in `STATUS.md` under "Recent Decisions" or write an ADR.

### Versioning

Every spec doc has a `**Version:** X.Y` header and a `**Changelog**` section near the top. When you change a doc:
- Patch (e.g., 0.1 → 0.2): clarifications, expansions, non-breaking additions.
- Minor (e.g., 0.2 → 0.3): contract changes that affect implementation.
- Add a changelog entry describing what changed.

### Anti-patterns to avoid

- **Don't** code first and "update docs later." You won't.
- **Don't** quietly let a module's actual API drift from its manifest. Either update the manifest or change the code back.
- **Don't** make architectural decisions in commit messages alone. ADR them.
- **Don't** leave `STATUS.md` saying "in progress" when you've actually finished or abandoned the work.

## 8. When You Don't Know Something

- **Spec is ambiguous:** ask the user. Don't guess on contracts.
- **Implementation detail not covered:** decide, document the decision in an ADR if it's architectural, and move on.
- **Spec disagrees with what you'd build:** flag it explicitly. The user may have updated context.
- **You think a spec is wrong:** say so. The docs are not sacred — they're the best current thinking. Pushback is welcome.

## 9. Closing Thought

The goal of this project is to *finish enough to use*, not to architect indefinitely. The user has explicitly chosen to stop speccing and start building. Don't drag them back into spec discussions unless an actual implementation question forces it. When in doubt, build the smallest viable thing that respects the contracts, ship it, and iterate.

The "Definition of Done" for the Center v1 is in `docs/center-srs.md` §10. Reach that. Then add modules.
