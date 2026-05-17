# Architectural Decision Records

Lightweight ADRs for the Laziness Center. Each significant architectural decision gets a numbered markdown file in this directory.

## When to write an ADR

Write one whenever you make a decision the user would want to understand the reasoning for six months from now. Examples:

- Choosing a library when multiple viable options exist (JWT lib, iframe sizing protocol, Postgres driver, etc.).
- Resolving an ambiguity in a spec.
- Deciding to defer a feature with a defined trigger to revisit.
- Diverging from what a spec said, with justification.

Don't write one for routine implementation choices that wouldn't survive a `git blame` interrogation. Use judgment.

## Naming

`NNNN-kebab-case-title.md` where `NNNN` is a four-digit zero-padded sequence (`0001`, `0002`, …). Numbers never reused.

## Format

Copy this template:

```markdown
# NNNN — Short Title

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Superseded by NNNN | Deprecated
**Deciders:** (usually: User + Claude Code session)

## Context

What is the situation? What forces are at play? Why are we deciding this now? 2–6 sentences.

## Options Considered

- **Option A** — short description. Pros, cons.
- **Option B** — short description. Pros, cons.
- (etc.)

## Decision

What we chose, in one or two clear sentences.

## Rationale

Why this option, given the context and the others. The reasoning future-you will want to read.

## Consequences

- Positive: what gets easier or possible.
- Negative: what becomes harder or constrained.
- Neutral: what's changed but isn't clearly good or bad.

## Revisit triggers (optional)

If this decision should be reconsidered when a specific thing happens, list it here. Examples: "if we ever have more than 5 modules sharing the event bus," "if Redis becomes a memory bottleneck."
```

## Rules

- **Once accepted, never edit.** If the decision changes, write a new ADR that supersedes the old one, and update the old one's status line.
- **Link related ADRs.** "Supersedes #0003" or "Refines #0007" in the header.
- **Keep them short.** A page is plenty. If you need more, the decision probably isn't atomic.
