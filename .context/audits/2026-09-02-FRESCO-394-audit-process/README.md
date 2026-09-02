# FRESCO-394 — Audit process doctrine (A4-M20 + §09)

Audit-4, epic FRESCO-359, ola-3, eje Disciplina. Docs + Jira only, zero code.

## What shipped

| AC | Action | Where |
|----|--------|-------|
| 1 — freeze CI opt, defer FRESCO-358 | §4 of `audit-process.md`; FRESCO-358 → `Rechazos` + comment; `Relates` 358↔359 | `.context/audits/audit-process.md`, Jira |
| 2 — monthly cadence, one epic at a time | §1 + §2 of `audit-process.md`; pointer section in `audits/README.md` | `.context/audits/audit-process.md`, `.context/audits/README.md` |
| 3 — hard "Finalizada" definition | §3 of `audit-process.md` (summary); full DoD doc delegated to **FRESCO-404**; `Relates` 394↔404 | `.context/audits/audit-process.md`, Jira |
| 4 — FRESCO-330 refine+ship redirect | `Relates` 330↔359 + redirect comment on FRESCO-330. Actual refine/ship of the 6 DRAFT stories is a separate L track, not this ticket | Jira |

## Notes

- FRESCO-357 (the caching work that landed, 5m55s → ~5m28s) stays. The freeze is
  about not starting FRESCO-358.
- ADR-0018's wall-clock trigger (~6m30s early-warning / ~8m hard) is the sole
  condition that reopens e2e-CI optimization.
- `audits/README.md` also carries pre-existing uncommitted audit-4 score-history
  fixes from an earlier session, folded into this PR since it is the same file.
