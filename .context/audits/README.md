# Audits

Committed copies of every external audit pass on Fresco, so each new pass has a
stable baseline to diff against instead of the auditor's memory or a file that
may not survive on disk (FRESCO-319, blind spot #4).

The rubric is frozen at **v1** across passes so scores are comparable.

## Passes

| Date | File | Scope | Notes |
|------|------|-------|-------|
| 2026-08-14 | `2026-08-14-audit-1-initial.html` | Initial project audit | Baseline ~4.7/5. The auditor's original file was lost on disk; this is the surviving saved copy. |
| 2026-08-21 | `2026-08-21-audit-2-reauditoria.html` | Re-audit | Delta after ~73 commits from the 21 Aug baseline. |
| 2026-08-29 | `2026-08-29-audit-3.html` | 3rd pass | Overall ~3.7/5 vs 4.7 baseline. Action plan: EPIC FRESCO-309. |

## Blind spots (FRESCO-319)

Surface the auditor could not measure directly. Status of each fix:

1. **Jira board access** — the integration is not granted `basiliomontescastano.atlassian.net`.
   Backlog + Traceability scores come from the committed mirror in `.context/PBI/`, not the live board.
   *Fix: owner grants read access to the auditor integration, or exports the board.*
2. **Authenticated app never exercised** — `/menu`, `/calendar`, `/shopping-list` fell outside every measure;
   `/qa` points to FRESCO-25 for credentials, no public demo.
   *Fix: owner shares `PRE_USER_*` credentials (already in `.env`) through a private channel.*
3. **GitHub required checks** — not readable from a clone. → captured in `branch-protection.md`.
4. **Audit reports not in the repo** — → this directory.

## Regenerating the branch-protection snapshot

```
gh api repos/BasiMontes/fresco/branches/main/protection
```

Run for `main`, `staging`, `dev` and paste into `branch-protection.md`.
