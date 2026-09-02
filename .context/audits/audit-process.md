# Audit process doctrine

How external audit passes on Fresco are run and remediated. Written for **A4-M20**
and **§09** of the audit-4 report (FRESCO-394, epic FRESCO-359, ola-3). This is a
process record, not an ADR — revisitable at any time without touching code.

The committed audit reports and the score history live in [`README.md`](./README.md).

---

## 1. Cadence — monthly, not weekly

Audit passes run **once a month**, not weekly.

Audits 1–4 ran on 2026-08-14, -21 (dated), -27 (actual), -29 and -31 — four passes
in ~17 days. Each pass opened a remediation epic before the previous one closed, so
the project was carrying overlapping remediation backlogs (FRESCO-278, -309, -359)
while the underlying app changed very little between passes. On a non-urgent
single-committer project that is measurement churn: the score moves inside the noise
band and the remediation epics compete for the one person's time.

- A pass is worth running when there is **enough delta to measure** — roughly a
  month of shipped work, or a specific triggering event (a security disclosure, a
  pre-launch gate, a major feature landing).
- Between passes, remediation work continues against the **open** epic. No new pass
  is scheduled just because a week elapsed.

## 2. One remediation epic open at a time

Only **one** audit-remediation epic is open at any moment.

The next pass does not start — and its epic is not created — until the current
remediation epic is genuinely closed: **every child `Finalizada`, the epic
`Finalizada`**, per the "Finalizada" definition in §3. This keeps the remediation
backlog a single legible queue instead of three interleaved ones, and forces each
pass's findings to actually land before the next pass piles on.

If a pass must run while an epic is still open (an emergency trigger), its findings
are **appended to the open epic**, not spun into a parallel one.

## 3. Hard definition of "Finalizada" (DoD)

A ticket does **not** move to `Finalizada` until the problem that created it is
**measurably zero** — not when the mechanism to fix it exists, and not when a
follow-up is "planned".

One-line principle:

> Close on the metric, not the mechanism. If the finding's metric is not zero, the
> ticket is not done — unless the residue is explicitly accepted and carries its own
> follow-up ticket.

Shapes this takes:

| Ticket kind | "Finalizada" means |
|---|---|
| Defect | the reproduction was reproduced, then is no longer reproducible, **and** evidence is attached |
| Data / backlog task | the verification query returns 0 |
| Decision / deferral | goes to `Rechazos` with an ADR or a process note — **not** `Finalizada` |

The **full DoD document** — close gates per ticket kind, the accepted-residue
escape hatch, and where it plugs into `/sprint-development` and
`bug-fix-workflow.md` — lives in
[`../backlog/definition-of-done.md`](../backlog/definition-of-done.md)
(FRESCO-404, A4-PROC, spawned from FRESCO-392). This section is the summary; that
document is the source of truth.

Origin: FRESCO-392 (A4-FWD-ONLY) closed four tickets (FRESCO-282 / 313 / 320 / 328)
that had been marked `Finalizada` while the finding's metric was still non-zero.

## 4. CI optimization is frozen

The `test:e2e` CI job is **green and inside budget** (~5.5 min as of 2026-09-02).
No further work goes into speeding it up until a real trigger fires.

- The **only** condition that reopens e2e-CI optimization is the wall-clock trigger
  in **[ADR-0018](../ADR/ADR-0018-e2e-test-architecture-revisit-threshold.md)**:
  early-warning at ~6m30s sustained (two consecutive `main`-bound runs), hard
  trigger at ~8m sustained. The pre-scoped response there is the racer-file →
  `testUserFactory` parallelism migration, not a new optimization project.
- **[FRESCO-358](https://basiliomontescastano.atlassian.net/browse/FRESCO-358)**
  (rearchitect the Supabase stack lifecycle to get `test:e2e` under 3 min) is
  **deferred → `Rechazos`**. Sub-3-min was an ambition without a cost trigger
  behind it.
- **A4-M20**: the rabbit hole this freezes — ~72 s of CI time chased across 3
  tickets (FRESCO-357/358 + ADR-0018's FRESCO-354), 1 ADR, 3 PRs and 5 bitácora
  entries, on a project the audit itself calls "not urgent (one committer)".

FRESCO-357 (the caching work that landed, 5m55s → ~5m28s) stays. This freeze is
about **not starting FRESCO-358**, not reverting anything.

---

## Revisit triggers for this doctrine

Loosen or change the above when:

- A second person joins delivery (overlapping epics and faster cadence may become
  worth the coordination cost), **or**
- Fixed sprints with a planning ceremony are adopted, **or**
- `test:e2e` wall-clock crosses the ADR-0018 early-warning (§4 reopens on its own
  terms), **or**
- A launch / investor gate makes a targeted off-cycle pass genuinely necessary.
