# FRESCO-378 (A4-H17) — Defect traceability backfill

**Ran:** 2026-09-01. Jira-only, no code change.

## What

Backfilled traceability on the **36 open/recent `Error` defects** (scope: not-`Finalizada` OR created ≥ 2026-08-19; owner-chosen cutoff). Per defect:

- `Relates` link to its origin epic (25 defects; the other 11 already had a `parent`) — mapping in `f378-map.tsv`
- `Severity 🚩` (`customfield_10194`) set by impact — mostly `menor`/`trivial` (UI/design/a11y), `moderada` for flow gaps, `mayor` for FRESCO-264 (email confirm link always prod) + FRESCO-312 (security headers)
- Evidence backfill comment — honest note (closed defects have no original artefact, pre-FRESCO-282); open defects flagged for re-verification before close

## Also

- **FRESCO-328** — `Finalizada` → `Rechazos` (it was a deferral to Supabase Pro, not a done; prod DB still shared)
- **FRESCO-320** — note added ("gate added, debt deferred; AC still not testable at close")
- **FRESCO-313** — gate verified live: `acli` create of a bare `Error` is rejected with `Severity 🚩 es obligatorio., 🧫EVIDENCE es obligatorio.`

## Files

- `f378-map.tsv` — the frozen defect → (origin epic, severity, evidence class) mapping
- `f378-backfill.ts.txt` — the one-shot script (REST: issueLink + field PUT + comment), kept as `.txt` so it stays out of the repo's lint/tsc. Idempotency: **not** re-runnable (would duplicate links/comments)
- `f378-plan.md` — the implementation plan (also on the Jira ticket)

## Verification

Post-run re-query of the 36: **0** without severity, **0** without a traceability link/parent.
