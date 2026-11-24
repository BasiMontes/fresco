# Audits

Committed copies of every audit pass on Fresco, so each new pass has a
stable baseline to diff against instead of the auditor's memory or a file that
may not survive on disk (FRESCO-319, blind spot #4).

The rubric is frozen at **v1** from audit-3 onward. Audit-1 used a different, informal
6-axis set (Diseño and Testabilidad as standalone axes); its 4.7 is **not** comparable
to the v1 scores.

## How to read the trend

**Trend is measured by findings closed, not by the absolute score.** Two passes with the same rubric
but different lenses and access can differ widely: audit "6 externa" (3,8/5, 1 Oct) and audit "6 interna"
(3,2/5, 2 Oct) are 0,6 apart in 24 hours on the same code. The external pass had no Jira and no hosted
database; the internal one walked the app on staging with a Free user. To compare passes, track for each
earlier finding whether it is closed, partial, accepted (with its ADR) or still open, and which new
findings appeared. Scores are only comparable inside one lens (same auditor, same access). The overlap
between the two 6th passes is mapped in [`2026-10-01-audit-6-externa-solapes.md`](./2026-10-01-audit-6-externa-solapes.md).

## Passes

| Date | File | Scope | Notes |
|------|------|-------|-------|
| 2026-08-14 | `2026-08-14-audit-1-initial.html` | Initial project audit | Baseline ~4.7/5, informal pre-v1 rubric. The auditor's original file was lost on disk; this is the surviving saved copy. |
| 2026-08-21 | `2026-08-21-audit-2-reauditoria.html` | Re-audit (Claude, 4 subagents) | ~3.7/5. File is misdated — the pass ran 2026-08-27. Action plan: EPIC FRESCO-278. |
| 2026-08-29 | `2026-08-29-audit-3.html` | 3rd pass | Overall **4.3/5** (first rubric-v1 pass; "considera el 4,3 como la línea base"). Action plan: EPIC FRESCO-309. Earlier revisions of this file wrongly recorded 3.7 (that is audit-2's score). |
| 2026-08-31 | `2026-08-31-audit-4.html` | 4th pass (Claude, 6 subagents) — deepest so far: exploit construction, RLS policy-by-policy, food-safety path trace, funnel instrumentation map, product-engineer lens | Overall **3.5/5** vs 4.3. 2 technical BLOCKERs (self-grant-Pro via RLS INSERT gap; food-safety guardrail with zero behavioral test coverage) + 2 product BLOCKERs (legal banner still live; MVP success metric not measurable). 71 findings. Triage + waves: `2026-08-31-audit-4-triage.md`. Path to 5/5: `2026-08-31-audit-4-plan-a-5.md`. Action plan: **EPIC FRESCO-359** (41 children FRESCO-360–400, labelled `ola-0`..`ola-3` = Sprints A–D). |
| 2026-09-28 | `2026-09-28-audit-5.md` | 5th pass (Claude, 6 subagents, first with an authenticated Pro user in the live app) | Overall **3.2/5**. Closed the blind spot #2 below. Action plan: **EPIC FRESCO-727** (closed). |
| 2026-10-02 | `2026-10-02-audit-6.md` + `2026-10-02-audit-6/` | **6 interna**: 6th pass (Claude, 6 subagents, one per axis, app tested live on staging) | Overall **3.2/5**, unchanged vs audit-5. 2 BLOCKERs (A6-S1: the RPC that fixed audit-5 B2 reopened it; A6-P1: FRESCO-434 legal review closed without evidence), 82 findings. Per-axis reports in the folder. Action plan: **EPIC FRESCO-775** (46 children FRESCO-776–821, labelled `ola-0`..`ola-3`). |
| 2026-10-01 | `2026-10-01-audit-6-externa.html` + `2026-10-01-audit-6-externa-solapes.md` | **6 externa**: 6th pass by Ely, `main@eb98b0e`, no Jira and no hosted DB access | Overall **3.8/5** (por eje: Verificación 4,3, Fundación 4,0, Arquitectura 3,8, Trazabilidad 3,8, Disciplina 3,6, Backlog 3,5 provisional). 10 weighty findings + a "para cuando pases cerca" list. Not comparable in score with 6 interna; overlap table maps each finding to a FRESCO-775 child or to FRESCO-828/829/830/831/833-839. |
| 2026-10-16 | `2026-10-16-audit-7/` | **7b**: 13 read-only axis audits (authz, payments, allergen safety, privacy and more), consolidated plan in `consolidated.md` | 157 raw findings. Action plan: **EPIC FRESCO-986** (label `auditoria-7b`). Added to this table on 2026-11-22; the figure is the raw count, see its consolidated report for the merged one. |
| 2026-11-03 | `2026-11-03-audit-8/` | **8**: 13 read-only axis audits run by subagents in 5 waves, commit `71ab0864` | No score given. 63 findings after merging 5 duplicate pairs (0 BLOCKER, 2 HIGH). Findings as reported by each axis auditor, not independently reproduced. Cards under FRESCO-986, label `auditoria-8` (all Done on 2026-11-22). Added to this table on 2026-11-22. |
| 2026-11-22 | `2026-11-22-audit-9/` | **9**: `agentic-audit` (subject `dev`, lens `internal`), off-cycle by owner decision, FRESCO-1252 | Overall **4.4/5** on six process-maturity axes (Foundation 4.5, Backlog 3.8, Traceability 4.5, Architecture 4.5, Verification 4.7, Agent discipline 4.5). **Not comparable with passes 4 to 8**: this one measures method, not security or safety. No BLOCKER or HIGH. Children go under FRESCO-986, label `auditoria-9`. |
| 2026-11-23 | `2026-11-23-audit-10/` | **10**: `agentic-audit` (subject `dev`, lens `internal`), regular pass brought forward by owner decision, one day after audit 9 | Overall **4.3/5** (Foundation 4.0, Backlog 4.0, Traceability 4.7, Architecture 4.5, Verification 4.5, Agent discipline 4.3). All nine audit-9 findings closed or accepted; 11 new findings, no BLOCKER. Same lens and rubric as audit 9, deeper reading of axes 1 and 6. First pass to read the hosted Supabase security advisor; the authenticated app stayed blocked by Turnstile. Action plan: **EPIC FRESCO-1270** (closed on 2026-11-24). Also in Spanish (`consolidated.es.md`, `2026-11-23-audit-10.es.html`), requested by the owner. |
| 2026-11-24 | `2026-11-24-audit-11/` | **11**: `agentic-audit` (subject `dev`, lens `internal`), **off-cycle by owner decision**, one day after audit 10; the next regular pass still counts from audit 10 (around 2026-12-23) | Overall **4.47/5**, kept at two decimals so the mean is not rounded up (Foundation 4.4, Backlog 4.2, Traceability 4.7, Architecture 4.5, Verification 4.6, Agent discipline 4.4). All 11 audit-10 findings closed, two with a residue; 9 new findings, no BLOCKER or HIGH. The owner decided all nine through a decision deck. Action plan: **EPIC FRESCO-1287** (cards FRESCO-1288 to 1293, label `auditoria-11`; F1 on its own card, the low and informative findings grouped into one hygiene card per axis). The F5 figures were corrected after delivery. Also in Spanish (`consolidated.es.md`, `2026-11-24-audit-11.es.html`). |

## Cadence & process

How passes are scheduled and remediated — monthly cadence, one remediation epic
open at a time, the hard definition of "Finalizada", and the CI-optimization
freeze — lives in [`audit-process.md`](./audit-process.md) (FRESCO-394, A4-M20 + §09).

## Blind spots (FRESCO-319)

Surface the auditor could not measure directly. Status of each fix:

1. **Jira board access** — ~~integration not granted~~ **RESOLVED** (audit-4): `acli` authenticates
   against `basiliomontescastano.atlassian.net`; the token also carries `Administer Jira`. Backlog +
   Traceability can now be scored from the live board.
2. **Authenticated app never exercised** — `/menu`, `/calendar`, `/shopping-list`, `/profile`, `/admin`
   fell outside every measure in passes 1-4. **RESOLVED** in audit-5, the first pass with an authenticated
   Pro user in the live app (audit-6 interna repeated it with a Free user; the admin role is still unmeasured live).
3. **GitHub required checks** — ~~not readable from a clone~~ **RESOLVED** → `branch-protection.md`.
4. **Audit reports not in the repo** — **RESOLVED** → this directory.

## Regenerating the branch-protection snapshot

```
gh api repos/BasiMontes/fresco/branches/main/protection
```

Run for `main`, `staging`, `dev` and paste into `branch-protection.md`.
