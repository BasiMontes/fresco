# ADR-0016 — Local fork of the agentic skills; we do not track upstream

- **Status:** Accepted <!-- Proposed | Accepted | Superseded by ADR-MMMM | Deprecated -->
- **Date:** 2026-08-30
- **Deciders:** Basi Montes
- **Tags:** tooling, skills, boilerplate, cross-cutting
- **Supersedes:** —
- **Superseded by:** —

---

## Context

Fresco was scaffolded from the `agentic-dev-boilerplate`, which ships `.claude/skills/`
and a `bun run up` (`cli/update-boilerplate.ts`) updater that pulls new upstream
versions of those skills.

`bun run up` has never been run. Since 2026-08-17 there are ~10 commits editing
`.claude/skills/` by hand — token trimming and doctrine changes from FRESCO-281,
FRESCO-282, FRESCO-290, FRESCO-294, FRESCO-318. The central `SKILL.md` files have
diverged from upstream (e.g. `sprint-development` ~595 vs ~702 lines,
`git-flow-master` ~487 vs ~602). A `bun run up` today would conflict across all
~11 core skills.

Upstream published changes on 2026-08-22 that are not here:

- PBI model as a gitignored cache instead of ~485 committed files
- `AGENTS.md` as the single instruction body
- a `git:policy` check (detects declared-vs-practiced strategy drift — the same
  gap FRESCO-314 addresses)
- a `context:hydrate` step

Running a frozen, fully-understood version is a legitimate choice. The risk is
that in three months nobody remembers whether the freeze was a decision or
inertia. This ADR makes it a decision.

## Decision

We will **treat `.claude/skills/` (and the rest of the boilerplate surface) as a
local fork** and **not run `bun run up`** as routine maintenance. The skills are
Fresco-owned source from here on: edit them in place, review the diff like any
other code.

If we ever decide to re-sync with upstream, the order that avoids pain is:

1. First migrate `.context/PBI/` to a gitignored cache (the ~485 committed files
   in a three-branch flow produced the drift hand-fixed in FRESCO-304).
2. Then run `bun run up` and resolve the skill conflicts deliberately.

**Revisit if** any of these becomes true:

- upstream ships a fix or capability we actually want (security fix, a check like
  `git:policy` we decide to adopt);
- maintaining the forked skills costs more than a one-time re-sync would;
- a new contributor needs the skills to match public boilerplate docs.

## Consequences

- **Positive:** no surprise conflicts on a routine command; the skills say exactly
  what Fresco does; token-trimmed skills stay trimmed; edits ship through normal
  PR review.
- **Negative / trade-offs:** we forgo upstream fixes and new capabilities unless
  we port them by hand; the gap widens over time, raising the cost of an eventual
  re-sync; the boilerplate's own docs no longer describe our skills exactly.
- **Neutral / follow-ups:** `bun run up` is not part of any runbook; the re-sync
  order above is the plan of record if the decision is reversed; FRESCO-314 covers
  the `git:policy`-shaped gap independently.

## Alternatives considered

- **Re-sync now (`bun run up`)** — rejected: conflicts across ~11 skills, and the
  PBI-cache migration must come first; large disruption for no pressing need.
- **Cherry-pick upstream changes as they land** — rejected for now: still needs a
  human to track the upstream changelog every release; no capacity for it, and
  nothing published so far is worth the overhead. Left open as a future mode.
- **Leave it undocumented** — rejected: that is exactly how a choice decays into
  unexplained inertia (audit-3 HALLAZGO BAJO H).

## References

- FRESCO-317 (audit-3 HALLAZGO BAJO H — this ADR)
- FRESCO-304 (PBI drift hand-fixed), FRESCO-314 (`git:policy`-shaped gap)
- FRESCO-281 / FRESCO-282 / FRESCO-290 / FRESCO-294 / FRESCO-318 (the hand edits)
- `cli/update-boilerplate.ts` — the `bun run up` updater
- ADR-0014 — same shape of decision (freeze the testing architecture, do not migrate)
