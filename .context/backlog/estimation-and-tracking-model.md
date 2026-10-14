# Backlog estimation & delivery tracking

> Decision record for **A4-M17** (audit-4, FRESCO-388). Not an ADR — this is a
> process choice, revisitable at any time without touching code.

## Current state (2026-09-02)

- **Story points**: present on ~6 of ~62 stories, **0 of 24 epics**. The
  `story_points` field (`customfield_10192`) is filled ad-hoc by
  `/sprint-development` Stage 1 for tickets it processes, not by refinement.
- **No sprint field, no sprints.** Work is pulled ticket-by-ticket. There is no
  cadence to measure a "points per sprint" velocity against.
- **One maintainer.** Throughput is bounded by one person's availability, not by
  a team's committed capacity.
- The three parked epics — **FRESCO-330 / 331 / 332** (`[DRAFT]` Horizonte 1-3)
  — carry no estimates and no child stories.

A velocity number computed from this is noise: too few data points, no fixed
interval, no team to normalise against.

## Decision — throughput tracking, not velocity

**Track throughput: tickets closed per calendar week**, split by type
(story / tech-debt / defect / task). Stop reporting or implying a "velocity".

- The signal we actually want is *"is the audit-remediation / feature backlog
  shrinking, and how fast"* — a weekly closed-count answers that directly.
- Story points stay **optional**: `/sprint-development` may still set one on a
  ticket it plans (it's a useful "this is bigger than it looks — split it"
  smell check at 13+), but nobody is expected to point the whole backlog, and
  no epic gets pointed.
- The DRAFT epics (330/331/332) are **not estimated up front**. They get
  estimated only if and when work is actually pulled from them — at which point
  their stories are refined and `/sprint-development` points them like any
  other ticket. Estimating a parked epic is wasted effort until it's real.

## What "tracking" looks like week to week

- The `.context/bitacora.md` session log already records every shipped ticket
  with a date. That IS the throughput ledger — no new tooling.
- Optional: a one-line weekly tally at the top of the current sprint/dev report
  or the bitácora ("week of YYYY-MM-DD: 5 tech-debts, 1 defect, 0 stories").
- Jira: a saved filter `project = FRESCO AND status CHANGED TO (Finalizada,
  Merged) DURING (startOfWeek(), endOfWeek())` gives the same number on demand.

## Revisit triggers

Switch back to (or add) point-based planning **only when**:

- A second person joins delivery (throughput stops being one person's rate and
  a shared commitment model starts to matter), **or**
- The team adopts fixed sprints with a planning ceremony, **or**
- Forecasting a fixed deadline becomes a real need (investor date, launch
  window) and stakeholders ask "will X be done by Y".

Until then: count what shipped, don't forecast what might.

## Update 2026-10-14 (FRESCO-927, audit A1-07)

The decision above is unchanged. This refreshes the numbers and settles the two things
the audit still listed as open.

**Where the numbers stand** (counted in Jira on 2026-10-14):

| What | 2026-09-02 | 2026-10-14 |
|---|---|---|
| Stories with Story Points | about 6 of about 62 | 46 of 273 |
| Open stories with Story Points | not counted | 12 of 14 |
| Epics with Story Points | 0 of 24 | 0 of 41 |

The two open stories without points are FRESCO-870 and FRESCO-442. FRESCO-870 was pointed
on 2026-10-14 (2, from its merged PR #547: five files, +71/-21). FRESCO-442 is in
Rechazos: pointing a rejected story is wasted work, so it stays empty on purpose. The
audit's "25 of 215 (12 %)" was a count over the whole history, which this model never
asked to fill: points are optional, and what matters is that the stories being worked
have one.

**ATP and ATR (`acceptance_test_plan`, `acceptance_test_results`): kept, not retired, not
populated.** They are the Modality B fields (Jira-native test management) of the QA
repository, and `/sprint-development` already defers them to that phase (Gotcha 18). In
this repository nobody writes them, which is why they sit at 0 on every item. Retiring
them would be a write to the Jira configuration that buys nothing and costs the QA repo
its fields. Revisit when the QA repository starts using Modality B on this project.

**One inconsistency to know about.** Gotcha 18 of `/sprint-development` says a story does
not clear Stage 1 without `story_points` (FRESCO-281, structured QA fields), while this
document says points are optional. In practice the story-points rule applies to the stories
that skill plans, which is what happened here; the model above still holds for everything
else. If the two should be one rule, that is a decision for the founder, not an edit.
