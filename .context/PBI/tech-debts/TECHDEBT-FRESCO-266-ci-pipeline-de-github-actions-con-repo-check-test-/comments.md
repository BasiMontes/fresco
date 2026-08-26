# Comments for FRESCO-266

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-266)

---

### Basi Montes - 8/26/2026, 6:07:18 PM

## Spec Implementation Plan (Dev)

### Goal

Add a GitHub Actions workflow (`.github/workflows/pr-check.yml`) that gates every PR against `dev`, `staging`, and `main` on `bun run repo:check` (format + lint + types + vars + skills). `bun run test:e2e` also runs, but as ***informational only*** (`continue-on-error: true`) until the deleted Supabase test users (`LOCAL*USER*EMAIL`, `PRO*TEST*USER_EMAIL`) are recreated — flipping it to blocking is a fast follow-up once that lands.

### Scope decisions (confirmed with user)

- Trigger branches: `dev` + `staging` + `main` (not just staging/main as the ticket text says) — real PR flow lands on `dev` (feature/**/fix/** base); dev→staging→main promotion is a direct ff-only push, not a PR, so a staging/main-only gate would almost never fire.
- `test:e2e` non-blocking for now (`continue-on-error: true`). Flip to blocking once Supabase test users are recreated (deferred, separate follow-up).
- No Vercel deploy step in this workflow — Vercel's own GitHub integration already auto-deploys on push per-branch, independent of GitHub Actions.

### Tasks

1. Create `.github/workflows/pr-check.yml`:
2. Document the `ENV_FILE` secret: add it in GitHub repo Settings → Secrets and variables → Actions, value = full local `.env` content (Supabase URL/anon key + test user creds + any var the Next.js app needs to boot). Never commit it.
3. Validate the workflow by opening a throwaway test PR against `dev` and confirming both jobs run (repo-check green/red as expected, e2e reports but doesn't block).
4. Enable "Require status checks to pass before merging" for `repo-check` only (not `e2e`) on `dev`, `staging`, `main` branch protection — this is a GitHub repo-settings change, done via `gh api` or the GitHub UI, confirmed with user before applying (protected-branch config change).
5. Update `.context/reports` / bitacora per session-logging convention once merged.

### Risks / out of scope

- `test:e2e` will likely fail (not error the build, since non-blocking) until Supabase test users exist again — tracked separately, not blocking this ticket.
- Branch protection API changes require repo admin scope on the `gh`/API token in use; confirm with user before applying step 4.

## Review Workload Forecast

Estimated: ~60 additions + 0 deletions = ~60 total lines
400-line budget risk: Low
Chain strategy: n/a (single file, single PR)
Decision needed before apply: No

---


_Synced from Jira by sync-jira-issues_
