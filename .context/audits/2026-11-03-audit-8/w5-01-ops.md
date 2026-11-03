# Audit-8 axis OPS (A8-OPS-NN)
Commit: 71ab0864 (staging) | Date: 2026-11-03 | Auditor: w5-01

## 1. Scope
Read: all 18 workflows in `.github/workflows` (run history via `gh run list`, 6 runs each; failed logs of dependency-audit 2026-11-02 and refresh-mercadona-catalog 2026-10-27), `vercel.json`, `next.config.mjs` (FRESCO-906 sharp exclusion), `edge-functions-drift.yml`, `docs/workflows/{hotfix,observability,promotion,stripe-go-live}.md`, `lib/jobs/heartbeat.ts`, `lib/email/resend.ts`, `lib/billing/confirmation-email.ts`, `app/api/waitlist/route.ts`, `instrumentation.ts`, A7 w4-01-ops.md.
Live read-only: 2 SELECTs on `cron.job` / `cron.job_run_details` (14 days), `supabase migration list --linked`, `vercel env ls` (names only, 3 calls), 4 GETs on pro/pre `/api/health` + `/api/health/jobs` (+1 OPTIONS `/api/waitlist`) = 6 of 40 prod requests, `bun audit` (read-only, registry lookup), `bun pm view` x3.

## 2. Findings

### A8-OPS-01 | MEDIUM | CONFIRMED | Weekly dependency audit red 2 runs in a row (and 3 of last 6) with a real CRITICAL; no issue/alert on failure
Evidence: `gh run list --workflow dependency-audit.yml`: 2026-11-02T16:20 failure, 2026-10-26T13:20 failure, 2026-10-19 success, 2026-10-12 failure. Log of the 11-02 run: `dompurify >=3.4.4 <=3.4.16 / posthog-js > dompurify / critical: DOMPurify SAFE_FOR_TEMPLATES bypass (GHSA-cg2g-xh64-v4q7)`, `high GHSA-mrv2-3pqr-j5jr`, `happy-dom >=17.0.0 <=21.0.3 / high GHSA-834v-8h66-3h79, GHSA-c8p4-j97h-3vg8`, "4 vulnerabilities (1 critical, 3 high)". Re-ran `bun audit --audit-level=high` locally now: identical result. Lockfile pins `dompurify@3.4.16` (package.json override `"dompurify": "^3.4.16"`, i.e. the override is what pins the vulnerable top of the range) and `happy-dom@20.14.6`. `bun pm view`: dompurify 3.4.17 and happy-dom 21.0.4 exist. `dependency-audit.yml` has a single step (`bun audit --audit-level=high`) and no failure-issue step, unlike stripe-e2e/uptime/db-backup which open an issue (see closed #803, #557, #615).
Impact: dompurify ships to the browser via posthog-js (production bundle); happy-dom is dev/test only (CI, not runtime). The red run only emails the owner via GitHub; two weeks passed without a fix.
Reproduction: command above.
Fix: raise override to `"dompurify": "^3.4.17"`, bump `happy-dom`/`@happy-dom/global-registrator` to a patched release (>=21.0.4, check test infra), add an `issues: write` step to dependency-audit.yml that opens/closes a `dependency-audit-failure` issue like the other monitors. Pin: `bun audit --audit-level=high` is already the gate; add a workflow lint test asserting each scheduled workflow has a failure-issue step.
Status vs audit 7: NEW.

### A8-OPS-02 | LOW | CONFIRMED | Waitlist confirmation email failure is `console.error` only (no Sentry), HTTP 502 to the user
Evidence: `app/api/waitlist/route.ts:61-63` `catch (error) { console.error('[/api/waitlist] failed to send the confirmation email', error); return ... status: 502 }`. Contrast with the subscription path, which since FRESCO-1005 reports to Sentry (`lib/billing/confirmation-email.ts:91` `Sentry.captureException`). Transport is Gmail SMTP (`lib/email/resend.ts:75-78`) with the same shared daily cap as Auth OTP; page is not linked from the UI (only API routes reference `lista-de-espera`), so reach is small today.
Impact: if Gmail rejects (app-password revoked, daily cap), every waitlist signup gets a 502 and nobody is alerted.
Fix: `Sentry.captureException(error, { tags: { email: 'waitlist-confirmation' } })` in the catch. Pin: unit test that a rejected send calls the capture.
Status vs audit 7: NEW (sibling of A7-OPS-03 path that was fixed only for the subscription email).

### A8-OPS-03 | INFO | CONFIRMED | `RESEND_API_KEY` is set in no Vercel scope; the whole outbound mail rides one Gmail account
Evidence: `vercel env ls` (all 43 rows, no pagination hint) lists `GMAIL_SMTP_APP_PASSWORD` in Production and Preview, no `RESEND_API_KEY` anywhere. `scripts/check-stripe-go-live.ts:174` accepts either. Code switches transport on `isGmailSmtpConfigured()`.
Impact: consistent with ADR-0021 and the go-live gate, but a single consumer Gmail account now carries Auth OTP + subscription confirmation + waitlist; one revoked app password stops all three. Hosted rate limits still unverifiable (A7-OPS-04).
Fix: none now; at launch buy the domain (FRESCO-886) and set RESEND_API_KEY. Already known (FRESCO-886, ADR-0021).

### A8-OPS-04 | INFO | CONFIRMED | Scheduled monitors still run every 3-9 h, not every 5 min; external monitor existence still unverifiable
Evidence: uptime-monitor runs 2026-11-03T11:16, 03:33, 11-02T22:27, 13:34, 05:16, 00:00, 11-01T20:54 ... (gaps 3-9 h; one 8 h gap overnight). `docs/workflows/observability.md:18` now states the limit (FRESCO-951) and names UptimeRobot as owner action. Already known (A7-OPS-01, FRESCO-951); not re-reported as a defect.

## 3. A7 findings re-verified
| A7-ID | Verdict | Evidence |
|---|---|---|
| A7-OPS-01 | STILL-OPEN (doc fixed, control owner-side) | Gaps still 3-9 h; `observability.md:18,21-23` documents it and the external UptimeRobot step; cannot see whether the monitor exists. |
| A7-OPS-02 | FIXED | `edge-functions-drift.yml` header: deploy "First waits for the PR Check run on the pushed SHA to finish green (FRESCO-1017)"; `hotfix.md` section "1b. Rollback of Edge Functions" (redeploy from a worktree on the good SHA with `deploy-changed-functions.ts`). Last 6 pushes all success. |
| A7-OPS-03 | FIXED (residual -> A8-OPS-02, A8-OPS-03) | `lib/billing/confirmation-email.ts:91` Sentry capture + `pending_confirmation_emails` row retried by `stripe-reconcile`; Gmail SMTP transport reaches real customers. |
| A7-OPS-04 | STILL-OPEN (unverifiable) | Hosted Auth rate limits / Gmail cap not readable without Management API token. |
| A7-OPS-05 | FIXED | `lib/jobs/heartbeat.ts:51` `MONITORED_JOBS = Object.keys(JOB_STALE_AFTER_HOURS)`; prod `/api/health/jobs` now returns `{"status":"ok","jobs":{stripe-reconcile, cleanup-abandoned-guest-users, purge-waitlist-signups, retry-posthog-erasures, send-weekly-reengagement-push: ok}}`. Not covered: `cleanup-expired-rate-limits` (low risk, table growth only). |
| A7-OPS-06 | STILL-OPEN (unverifiable) | Sentry alert rules/quota not readable. |

## 4. Checklist items that found nothing
- pg_cron: 6 active jobs (`cleanup-abandoned-guest-users`, `send-weekly-reengagement-push`, `cleanup-expired-rate-limits`, `stripe-reconcile-subscriptions`, `retry-posthog-erasures`, `purge-waitlist-signups`); 14-day `cron.job_run_details`: all `succeeded`, max runtime 0.17 s, last runs 2026-11-03 03:00-04:30 UTC (weekly push 11-01 18:00).
- Migrations ledger: `supabase migration list --linked`, last migration 20261029160000; no local/remote mismatch found (compared pairs with awk; empty output). migration-drift-check and edge-functions-drift: last 6 push runs success.
- Backups: db-backup success daily 10-29..11-03; restore drill last 2026-10-08 (earlier two attempts failed, third success; quarterly cadence, not due).
- Health: pro and pre `/api/health` 200 (0.5 s / 1.5 s), `/api/health/jobs` 200.
- Vercel limits: `vercel.json` disables `dev` deployments, `ignoreCommand` set; `next.config.mjs:68-69` excludes `node_modules/sharp` and `@img` from tracing (FRESCO-906); promotion.md documents the 100/day and 10 GB caps and batching. Retention (`deploymentsToKeep`) is a project setting, not in repo.
- Failing scheduled workflows: refresh-mercadona-catalog failed 10-13, 10-20, 10-27 (last log: lint-staged `eslint --fix` exit 1 on the bot commit, fixed by PR #831/#832; manual dispatches 10-30 succeeded and merged PR #832; next schedule due Tue 11-03 06:00 UTC, no run listed yet, GitHub lag). hosted-catalog-allergen-audit green 6/6. stripe-e2e failed 10-26 once, green since. Others green.
- Env drift (names): Preview has the 3 per-env `STRIPE_WEBHOOK_SECRET_{DEV,PRE,PROD}` + `STRIPE_WEBHOOK_ID_DESTINO_*`; Production has `STRIPE_WEBHOOK_SECRET`; consistent with `process.env` use in code. `ADMIN_USER_ID`, `CRON_SECRET`, Sentry vars present in both.
- Bad-input 500s: `request.json()` in waitlist/consents is inside try; checkout and guest-email use `.catch(() => null)`.
- SPOF (accepted/known): one Supabase project for dev/pre/pro (ADR-0020), one maintainer, one `SUPABASE_ACCESS_TOKEN` PAT used by workflows.
- Hotfix/promotion docs vs code: Edge rollback section now matches `deploy-changed-functions.ts`.

## 5. Could not verify
Sentry alert rules, event quota and actual noise; Vercel `deploymentsToKeep` and current Functions Storage usage; hosted Supabase Auth rate limits and Gmail cap; whether UptimeRobot exists; R2 lifecycle / BACKUP_PASSPHRASE copy. No tokens used beyond the already logged-in CLIs.

## 6. Hygiene
secrets_materialized: none
cleaned: yes (log files under audit8 scratchpad contain only public CI log text: depaudit.log, merc.log)
