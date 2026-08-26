# Comments for FRESCO-270

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-270)

---

### Basi Montes - 8/26/2026, 6:47:09 PM

## Spec Implementation Plan (Dev)

### Goal

Record the decision to stay on `playwright-bdd` (not migrate to KATA) as `ADR-0014`, per the ticket's own plan of action.

### Tasks

1. Create `.context/ADR/ADR-0014-testing-architecture-playwright-bdd.md` from the template — Context grounded in the actual repo (`playwright.config.ts`'s `workers: 1` rationale, `.context/qa/regression.feature`/`README.md` conventions), Decision, Consequences, Alternatives considered, and explicit signals that would justify revisiting.
2. Add the index row in `.context/ADR/README.md`.
3. Draft as `Status: Proposed` per the ADR doctrine (AI drafts, human accepts) — confirmed with user, flipped to `Accepted`.

### Notes

- Docs-only change, no code path, no live-UI validation needed.
- Next free ADR number was 0014 (0010 is a pre-existing gap in the sequence, left alone).

## Review Workload Forecast

Estimated: ~70 additions + 0 deletions = ~70 total lines
400-line budget risk: Low
Chain strategy: n/a (single file, single PR)
Decision needed before apply: No

---


_Synced from Jira by sync-jira-issues_
