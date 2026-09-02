# Definition of Done

> Decision record for **A4-PROC** (audit-4, FRESCO-404, spawned from FRESCO-392).
> Not an ADR — this is a process choice, revisitable at any time without touching
> code. Sibling of [`estimation-and-tracking-model.md`](./estimation-and-tracking-model.md).

## The principle

**Close on the metric, not the mechanism.**

A ticket does not move to `Finalizada` until the problem that created it is
**measurably zero** — not when the fix has been written, not when a mechanism to
prevent recurrence exists, and not when a follow-up is merely "planned".

The one escape hatch: a **residue that is explicitly accepted** and carries its own
follow-up ticket (see [§ Accepted residue](#accepted-residue)). "We'll finish it
later" without a ticket is not acceptance — it is an open ticket wearing a `Finalizada`
label.

### Why this exists

FRESCO-392 (A4-FWD-ONLY) had to re-open and re-verify four tickets — FRESCO-282,
313, 320, 328 — that had been marked `Finalizada` while the finding's metric was
still non-zero: defects with no traceability link, acceptance criteria that were not
actually testable, an "isolation" fix that was really a deferral. The audit called
this the *forward-only closure habit*. This document is the gate against it.

## Close gates by ticket kind

Before transitioning to a terminal status, the closer confirms the row for that
ticket kind. If the evidence is not there, the ticket is **not** closable — produce
the missing evidence first, or accept the residue explicitly.

| Ticket kind | "Done" means | Required evidence |
|---|---|---|
| **Defect** (`Error`) | the reproduction was reproduced, then is no longer reproducible after the fix | numbered repro steps **or** a documented rejection rationale (FRESCO-313); `Relates`/`parent` link to the regressed story/epic + a screenshot in `evidence` — HAR too for network/API defects (FRESCO-282); `severity` + `error_type` set, `root_cause` set at close (FRESCO-281) |
| **Data / backlog task** | the verification query returns **0** (or hits the stated target) | the exact query + its `0` result, pasted in a comment or the trail doc |
| **Feature story** | every AC scenario is covered by a passing test, manual evidence, or an explicit `exempt:<reason>` | Stage 3 Spec Compliance Matrix with no `uncovered` rows (`/sprint-development`); Gherkin AC scenarios automated in the same PR unless the ADR-0014 budget clause applies |
| **Decision / deferral** | the decision is recorded where it belongs | goes to `Rechazos` with a pointer to the ADR or process note — **never** `Finalizada`. A deferral is not a completion |
| **Process / docs task** | the artifact exists at its stated path **and** the things it claims to wire are actually wired | the doc, plus each cross-reference it promises (skill pointer, README section, ADR backlink) verified present |

## Accepted residue

A ticket may close with known remaining work **only if all three hold**:

1. The residue is **named explicitly** — in a closing comment or the ticket body,
   not left implicit.
2. It carries its **own follow-up ticket** (or is folded into a named existing one),
   linked `Relates`.
3. The follow-up ticket's scope is concrete enough that someone else could pick it
   up — not "revisit this area".

Absent any of the three, the residue is just unfinished work and the ticket stays
open.

## Where this plugs in

- **`bug-fix-workflow.md`** — Phase 3 (reproduction-or-rejection gate) and Phase 7
  (close confirmations) are the **defect-specific instance** of this DoD. The
  FRESCO-281 / 282 / 313 contracts enumerated there are the "Defect" row above.
- **`/sprint-development`** — Stage 3's Spec Compliance Matrix is the "Feature story"
  row's gate; Gotcha 13 (structured QA fields) is part of the "Defect" row.
- **`audit-process.md` §2 / §3** — "one remediation epic open at a time" depends on
  *every* child actually being done by this definition before the next audit epic
  opens; §3 is the summary of this document.

## Revisit triggers

Loosen or restructure this when:

- A dedicated QA phase / repo comes online and owns the defect close gates directly
  (the FRESCO-281/282/313 contracts move there), **or**
- Fixed sprints with a formal Definition of Done ceremony are adopted (this becomes
  the team's DoD checklist, maintained there), **or**
- The `Rechazos` vs `Finalizada` distinction stops being meaningful in the Jira
  workflow (e.g. the workflow is redesigned).

Until then: a ticket is done when its finding's metric is zero, or the residue is a
named, ticketed, concrete follow-up.
