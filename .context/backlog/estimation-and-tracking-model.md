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
