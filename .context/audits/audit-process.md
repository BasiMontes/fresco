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
remediation epic is genuinely closed: **every child `Finalizada` or `Rechazos`,
the epic `Finalizada`**, per the "Finalizada" definition in §3. This keeps the
remediation backlog a single legible queue instead of three interleaved ones, and
forces each pass's findings to actually land before the next pass piles on.

Two statuses need a rule, because neither is `Finalizada`:

- **`Rechazos`** means the owner decided it will not be done. It is terminal for
  this rule: a child there does not hold the epic open. §3 still requires an ADR
  or a process note behind the rejection.
- **`Aplazada`** means decided but blocked by money or by a consent that does not
  exist yet. It does not count towards closing. When a remediation epic is about to
  close, its `Aplazada` children move to the parked epic FRESCO-1261 ("Aparcado:
  trabajo bloqueado por dinero o consentimiento"), with the blocking condition
  written on the card. Decided by the owner on 2026-11-23 (audit 9, finding F5).

If a pass must run while an epic is still open, its findings are **appended to the
open epic**, not spun into a parallel one. An off-cycle pass is allowed in two cases:

- **An emergency trigger** (a security disclosure, a failed gate).
- **An explicit owner decision** to measure progress before the epic closes (for
  example, to see how far the remediation has moved a score or a finding count).

Conditions for any off-cycle pass:

- The decision is **recorded in the pass's consolidated report**, with the open
  epic's key and its child status counts at that moment.
- Children go under the **open epic** with their own label (for example
  `auditoria-8`), never under a new epic. Low and informative findings are grouped
  into one hygiene card per axis, as in audit 6 and audit 8.
- The pass does not reset the clock of §1: the next regular pass is still counted
  from the last regular one.

Precedent: audit 8 (2026-11-03) ran while FRESCO-986 was open, by owner decision.
Its cards (FRESCO-1085 to FRESCO-1105 and the hygiene cards FRESCO-1106 to
FRESCO-1114) sit under FRESCO-986. The child status counts at that moment are in its
consolidated report, `2026-11-03-audit-8/consolidated.md`.

### Cards without an epic

Every card needs an epic; the rule started on 2026-10-08. Cards created before that
date that are already finished, and have no parent, are accepted as they are: there
is no retroactive sweep (audit 9, finding F2). The standing check is that no open
card lacks an epic. Run it with:

```
project = FRESCO AND issuetype != Epic AND parent is EMPTY AND statusCategory != Done
```

It must return 0. Anything it lists gets an epic, chosen by reading the epic of the
card it follows up.

### Accepted history

Pushed history is never rewritten (`AGENTS.md` rule 5), so two things the current
rules forbid stay in it, recorded here as accepted (audit 9, finding F6). Counts were
measured with `git log --all` on 2026-11-23.

- **`Claude-Session:` trailer.** 230 commits, 2026-08-29 to 2026-10-14. 112 of them
  are before 2026-09-07; from that day rule 3 of `AGENTS.md` carried one scoped
  exception that allowed a harness session trailer on commits written by an AI
  session (commit `8d20ac89`), and 118 are after it. The forensic `Worktree:` and
  `Session:` trailers replaced it on 2026-10-15 (commit `6bbe0bbe`), and `Claude-Session:`
  is forbidden since. There are none after 2026-10-14. So rule 3 did not apply
  backwards: the trailer was allowed in writing for most of the range, and no written
  rule either way was found for the first 112 commits.
- **Author `test <test@example.com>`.** 113 commits on `main`, 2026-09-09 to
  2026-10-02, 86 of them `docs:` and 70 of them bitacora entries. A placeholder git
  identity, not a person. There are none after 2026-10-02, and `bun run git:promote`
  now refuses any commit signed with `*@example.com`.

Both are closed at the source. Nothing is done to the history.

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

The `test:e2e` CI job is **inside budget** unless the ADR-0018 trigger below has fired. The duration
is not quoted here because it changes with the repo: measure it with `bun run ci:e2e-wallclock`
(FRESCO-1280), which reads the last green `test:e2e` jobs of the `staging` pushes from GitHub Actions
(`pr-check.yml`) and exits 1 when the early warning or the hard trigger fired. Run it in every audit pass.
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

## 5. The closing criterion on new cards

Cards carry their closing criteria in the description under `## Criterio de cierre` (FRESCO-1253). The audit
checks it forward only, from the day the convention started, and never backfills the cards that came before.

```
project = FRESCO AND created >= "2026-11-24" AND status not in (Aplazada, Rechazos) AND description !~ "Criterio de cierre"
```

It must return **0**. Run it with `acli jira workitem search --jql '<query>'` in every audit pass and fix whatever
it lists. Jira's text search is fuzzy: it can miss a card that mentions the words without the section, so a 0
is a screen, not a proof.

`Verificación` is not a closing-criteria heading. Where cards use it, it holds a measurement taken after the work
or a check to run after the deploy, and `scripts/sync-jira-issues.ts` deliberately does not read it as criteria
(FRESCO-1279, audit 10 F9). Older cards that use only that heading, or no heading at all, are not backfilled.

---

## 6. The chaos exercise before each pass

No chaos experiment runs in the CI (decided with FRESCO-1251). They run by hand **right before each audit pass, in
the working session, with the local stack up**: the auditor works read-only and does not start the stack (owner
decision of 2026-11-24, audit 11 F8). The list of what to run, what to compare and when to reopen the decision lives
in [docs/workflows/chaos-experiments.md](../../docs/workflows/chaos-experiments.md), section "Decisión sobre el CI".

In short: `scripts/chaos/local.sh flows` must exit `0`; the fault scenarios are read against the last row of the
registry; `bun run chaos:stripe-stall` must give up inside the agreed limit; and a new row and one card per new
weakness are written down. The audit then reads that row: dated in the same week as the pass, it counts; older or
missing is a finding. A pass without it leaves resilience unmeasured, the same way the e2e wall-clock was before
`bun run ci:e2e-wallclock`.

---

## Revisit triggers for this doctrine

Loosen or change the above when:

- A second person joins delivery (overlapping epics and faster cadence may become
  worth the coordination cost), **or**
- Fixed sprints with a planning ceremony are adopted, **or**
- `test:e2e` wall-clock crosses the ADR-0018 early-warning (§4 reopens on its own
  terms), **or**
- A launch / investor gate makes a targeted off-cycle pass genuinely necessary.
