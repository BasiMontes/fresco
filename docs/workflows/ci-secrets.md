# CI secrets: who can read what

FRESCO-802 (audit-6 A6-D6). The repository is public. A pull request from a branch of the **same** repo runs its own copy of the workflows with the repo's secrets in reach, so a compromised collaborator or a dependency with a `postinstall` could read whatever a workflow gets.

## Rule

A workflow triggered by `pull_request` references **no secret**. `scripts/ci-secrets-policy.test.ts` enforces it (and that every `uses:` is pinned by commit SHA, which `sha_pinning_required` needs).

## What each workflow reads

| Workflow | Trigger | Secrets | Notes |
|---|---|---|---|
| `pr-check.yml` | `pull_request`, `push` | none | `e2e` builds `.env` from the committed `.env.ci` plus dummy values; the job summary lists the variable **names** it can read |
| `post-deploy-smoke.yml` | `deployment_status` (Production only) | `LIVE_E2E_ENV_FILE`, else `ENV_FILE` | drives a browser against the real production deployment, so it needs real test-user and Supabase credentials |
| `stripe-e2e.yml` | `schedule`, `workflow_dispatch` | `LIVE_E2E_ENV_FILE`, else `ENV_FILE` | real Stripe test-mode account |
| `edge-functions-drift.yml` | `schedule`, `workflow_dispatch`, `push` | `SUPABASE_ACCESS_TOKEN` | deploys edge functions |
| `migration-drift-check.yml` | `schedule`, `workflow_dispatch`, `push` | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` | |
| `db-backup.yml` | `schedule`, `workflow_dispatch` | R2 keys, `SUPABASE_DB_PASSWORD`, `BACKUP_PASSPHRASE` | |
| `refresh-mercadona-catalog.yml`, `refresh-supermarket-prices.yml` | `schedule` / `workflow_dispatch` | `CATALOG_REFRESH_TOKEN`; `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | |

## What the PR e2e job can read

Only `.env.ci` (Supabase's public local-dev demo constants and dummy third-party values) and the dummies written in the step "Build .env from the committed CI overlay (no secret)". Nothing from production. Every run prints the names in its job summary.

## Owner actions (need repository admin)

1. **Create `LIVE_E2E_ENV_FILE`** with only the names the suite reads (checked with `rg 'process\.env\.'` over `tests/` on 2026-10-06), then delete `ENV_FILE`:

   ```sh
   grep -E '^(DEV_USER_EMAIL|DEV_USER_PASSWORD|PRO_USER_EMAIL|PRO_USER_PASSWORD|NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|STRIPE_PRICE_ID_PRO_MONTH|STRIPE_WEBHOOK_SECRET|STRIPE_WEBHOOK_SECRET_DEV|STRIPE_WEBHOOK_SECRET_PRE)=' .env \
     | gh secret set LIVE_E2E_ENV_FILE
   ```

   Verify with a manual run of `stripe-e2e.yml` (`workflow_dispatch`) before deleting `ENV_FILE`; the smoke run only happens on a production deploy.
2. **Replace `SUPABASE_ACCESS_TOKEN`** (an account-wide personal access token) with the narrowest token Supabase offers for deploying functions and reading migrations. Whether Supabase currently offers project-scoped tokens was not verified here; check the dashboard before choosing.
3. **`sha_pinning_required`**: with every action pinned, enable it in Settings > Actions > General ("Require actions to be pinned to a full-length commit SHA"), or `gh api -X PUT repos/<owner>/<repo>/actions/permissions -F enabled=true -f allowed_actions=all -F sha_pinning_required=true`.
