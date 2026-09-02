# Audits

Committed copies of every external audit pass on Fresco, so each new pass has a
stable baseline to diff against instead of the auditor's memory or a file that
may not survive on disk (FRESCO-319, blind spot #4).

The rubric is frozen at **v1** from audit-3 onward. Audit-1 used a different, informal
6-axis set (Diseño and Testabilidad as standalone axes); its 4.7 is **not** comparable
to the v1 scores. Compare each new pass against audit-3's 4.3.

## Passes

| Date | File | Scope | Notes |
|------|------|-------|-------|
| 2026-08-14 | `2026-08-14-audit-1-initial.html` | Initial project audit | Baseline ~4.7/5, informal pre-v1 rubric. The auditor's original file was lost on disk; this is the surviving saved copy. |
| 2026-08-21 | `2026-08-21-audit-2-reauditoria.html` | Re-audit (Claude, 4 subagents) | ~3.7/5. File is misdated — the pass ran 2026-08-27. Action plan: EPIC FRESCO-278. |
| 2026-08-29 | `2026-08-29-audit-3.html` | 3rd pass | Overall **4.3/5** (first rubric-v1 pass; "considera el 4,3 como la línea base"). Action plan: EPIC FRESCO-309. Earlier revisions of this file wrongly recorded 3.7 (that is audit-2's score). |
| 2026-08-31 | `2026-08-31-audit-4.html` | 4th pass (Claude, 6 subagents) — deepest so far: exploit construction, RLS policy-by-policy, food-safety path trace, funnel instrumentation map, product-engineer lens | Overall **3.5/5** vs 4.3. 2 technical BLOCKERs (self-grant-Pro via RLS INSERT gap; food-safety guardrail with zero behavioral test coverage) + 2 product BLOCKERs (legal banner still live; MVP success metric not measurable). 71 findings. Triage + waves: `2026-08-31-audit-4-triage.md`. Path to 5/5: `2026-08-31-audit-4-plan-a-5.md`. Action plan: **EPIC FRESCO-359** (41 children FRESCO-360–400, labelled `ola-0`..`ola-3` = Sprints A–D). |

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
   fell outside every measure in all 4 passes. Still open.
   *Fix: owner shares `PRE_USER_*` credentials (already in `.env`) through a private channel.*
3. **GitHub required checks** — ~~not readable from a clone~~ **RESOLVED** → `branch-protection.md`.
4. **Audit reports not in the repo** — **RESOLVED** → this directory.

## Regenerating the branch-protection snapshot

```
gh api repos/BasiMontes/fresco/branches/main/protection
```

Run for `main`, `staging`, `dev` and paste into `branch-protection.md`.
