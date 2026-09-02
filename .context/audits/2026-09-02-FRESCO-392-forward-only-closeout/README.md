# FRESCO-392 (A4-FWD-ONLY) — forward-only closure close-out

**Ran:** 2026-09-02. Jira-only, no product code.

## What

FRESCO-392 is the umbrella tracking ticket for the 4 "forward-only" closures the
audit flagged as closed-on-paper. This pass verified each condition and recorded it.

| Ticket | FRESCO-392 condition | State after this pass |
|--------|---------------------|-----------------------|
| FRESCO-282 | H17 shows the ~40 open/recent defects with story link + Severity + Evidence | **Met.** FRESCO-378 (A4-H17, Merged 2026-09-01) backfilled 35 defects. Verified via REST (e.g. FRESCO-315 → parent FRESCO-309 + sev `moderada`; FRESCO-264 → Relates FRESCO-18 + sev `mayor`). Constancia comment added. Stays `Finalizada`. |
| FRESCO-313 | same + Severity/Evidence gate on the Error screen | **Met.** Gate verified live in A4-H17 and re-confirmed creating FRESCO-401. Constancia comment added. Stays `Finalizada`. |
| FRESCO-320 | M18 delivers testable AC to FRESCO-245/246/274/275 | **Met.** FRESCO-388 (A4-M18, Merged 2026-09-02) gave observable Gherkin AC to FRESCO-245/246/249; FRESCO-274/275 were already `Finalizada`. Constancia comment added. Stays `Finalizada`. |
| FRESCO-328 | `Finalizada` → `Rechazos` + comment pointing to ADR-0020 | **Completed here.** Already moved to `Rechazos` in A4-H17; that comment cited "§08 del informe". ADR-0020 was created later (FRESCO-389), so this pass added the explicit ADR-0020 pointer. |

## Also

- **FRESCO-404** created — the Ola-3 process ticket for the hard "Finalizada" DoD
  ("a ticket does not close until the problem is measurably zero"), child of
  FRESCO-359, labels `auditoria-4` + `ola-3`, status `Listo`. Referenced from
  FRESCO-392's AC; not implemented this session.

## Files

- `f392-closeout.ts.txt` — the one-shot REST script (5 comments + 1 issue create),
  kept as `.txt` so it stays out of lint/tsc. **Not** re-runnable (would duplicate).

## Verification

- All 4 tickets carry their constancia comment; FRESCO-328 comment points to
  `.context/ADR/ADR-0020-single-supabase-project-until-pro.md`.
- FRESCO-404 exists as a child of FRESCO-359 with the two audit-4 labels.
