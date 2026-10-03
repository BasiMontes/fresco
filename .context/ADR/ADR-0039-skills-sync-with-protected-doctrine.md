# ADR-0039 — Skills are synced from the boilerplate; project-owned doctrine is protected from the sync

- **Status:** Accepted <!-- Proposed | Accepted | Superseded by ADR-MMMM | Deprecated -->
- **Date:** 2026-10-03
- **Deciders:** Basi Montes
- **Tags:** tooling, skills, boilerplate, cross-cutting
- **Supersedes:** ADR-0016
- **Superseded by:** —

---

## Context

ADR-0016 (2026-08-30) declared `.claude/skills/` a local fork and said `bun run up` would not be run as routine maintenance. That stopped being true on 2026-09-07: the sync `8d20ac8` (FRESCO-454) moved the skills to `.agents/skills/` as the single source (ADR-0038) and `bun run up` has been the update path since.

The sync regenerated the skill files and silently dropped Fresco-owned doctrine that lived inside them: the reproduction-or-rejection gate (FRESCO-313), the Definition of Done "close on the metric, not the mechanism" (FRESCO-404) and the AC testability gate I22 (FRESCO-320). The external audit of 2026-10-01 found it, and ADR-0016 still said the opposite of what the repo does.

## Decision

We will **keep syncing the skills from the boilerplate** (`bun run up`) and **protect the files that carry Fresco-owned doctrine** through `updater.protected_paths` in `.agents/project.yaml`. A protected file is never overwritten; upstream drift on it surfaces as a row in the updater's parity prompt and is merged by hand.

A test (`scripts/skill-gates.test.ts`) greps the text of each gate and checks the files are listed in `updater.protected_paths`, so a gate cannot disappear, or lose its protection, without a red build.

Any new project-owned rule that lives inside a synced skill file must be added to the same test and to `updater.protected_paths` in the same change.

## Consequences

- **Positive:** upstream fixes keep flowing; Fresco doctrine survives a sync; a silent loss fails CI.
- **Negative / trade-offs:** each protected file stops receiving upstream improvements automatically and needs a manual merge when upstream touches it. The protected list grows with every new project-owned rule.
- **Neutral / follow-ups:** the lost gates FRESCO-281, FRESCO-282 and FRESCO-321 (structured QA fields, defect-feature link, Gherkin automated in the same PR) are not covered by this change; port them under the same mechanism if they are still wanted.

## Alternatives considered

- **Stay a frozen local fork (ADR-0016)** — rejected: it no longer matches the repo, and it forfeits upstream fixes.
- **Move the doctrine into separate project-only reference files** — better isolation, but a larger refactor of how the skills load references; revisit if the protected list keeps growing.
- **Rely on code review to notice a dropped gate** — rejected: it already failed once, and the sync diff was large.

## References

- FRESCO-830, external audit 6 (2026-10-01), finding "Los gates de cierre desaparecieron en la sincronización de skills".
- FRESCO-454 (the sync `8d20ac8`), ADR-0016, ADR-0038.
- `scripts/skill-gates.test.ts`, `updater.protected_paths` in `.agents/project.yaml`.
