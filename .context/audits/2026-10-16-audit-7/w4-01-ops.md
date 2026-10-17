# Audit-7 wave 4, axis OPS (A7-OPS-NN)
Commit: 1feb6062 (staging) | Date: 2026-10-17 | Auditor: w4-01

## 1. Scope inspected
Files: `.github/workflows/{db-backup,db-restore-drill(head),uptime-monitor,cron-heartbeat-monitor,migration-drift-check,edge-functions-drift}.yml`, `ADR-0020` (backup section), `ADR-0021`, `docs/workflows/{observability,hotfix,promotion}.md`, `app/api/stripe/webhook/route.ts`, `lib/billing/grant-pro.ts`, `lib/email/resend.ts`, `lib/posthog/server.ts`, `lib/jobs/heartbeat.ts`, `scripts/vercel-ignore-build.sh`, `scripts/deploy-changed-functions.ts` (grep), `vercel.json`, `supabase/config.toml` (grep), sentry/instrumentation configs (grep).
Live: 3 read-only DB SELECTs via `supabase db query --linked` (cron.job, cron.job_run_details 3d, storage.buckets), `supabase functions list` (read), `gh run list` (read) x5, 4 prod/pre GETs (`/api/health`, `/api/health/jobs` each env) = 4 of 60 prod/pre requests. No auth session used.

## 2. Findings

### A7-OPS-01 | MEDIUM | CONFIRMED | Uptime/cron monitors fire every ~3-5 h, not every 5 min / 1 h
Evidence: `uptime-monitor.yml:18` `cron: '*/5 * * * *'`; `docs/workflows/observability.md` "Every 5 minutes". `gh run list --workflow uptime-monitor.yml --limit 30` created_at: 10-17T08:32, 04:11, 00:03, 10-16T21:54, 18:57, 15:32, 11:41, 06:24, 01:43, 10-15T23:50, ... gaps 2-5 h (median ~3.5 h; 30 runs cover ~3.5 days instead of ~8.6 h x... 30 runs at 5 min = 2.5 h). Cron heartbeat (`'23 * * * *'`) runs 10-17T05:41, 00:35, 10-16T21:23, 17:31, 12:34 (gaps 3-5 h). Docs only say "best-effort ... a floor".
Impact: a production outage at launch can go unnoticed for hours; the only alert is a GitHub issue email to a single owner. The "external monitor" (UptimeRobot) is documented as optional owner action and there is no evidence in the repo it was set up.
Reproduction: command above (read-only).
Fix: set up the external 5-min monitor (free) and record in observability.md that it exists; state the real GitHub cadence (hours). Pin: none automatable; add a doc check that the external monitor id/URL is referenced.

### A7-OPS-02 | MEDIUM | CONFIRMED | Edge Functions deploy to the shared prod project on push to `staging`, before the promotion gate; no Edge rollback path documented
Evidence: `edge-functions-drift.yml` header "deploy on `push: [staging]` only" and job `deploy` has no `needs` on PR Check; concurrency group only serialises vs e2e. `scripts/deploy-changed-functions.ts:155-168` deploys per slug, collects `failed`, then `process.exit(1)` (partial set stays deployed). `docs/workflows/promotion.md` gate (`git:promote`) governs only the `main` push (Vercel app). `docs/workflows/hotfix.md` section 0 and 5 cover Vercel rollback and DB forward-fix, nothing for Edge (rg "edge.*(rollback|revert|previous version)" over docs/ADR/skills: no hit).
Impact: a staging commit with a red PR Check, or a Vercel-prod/Edge version skew window (new Edge code live, old frontend on main until the batch promotion, which the founder wants to be days apart, FRESCO-925), can break menu generation/shopping-list/delete-account for all users with no documented undo. Supabase has no one-click prior-version redeploy documented here; rollback = redeploy an older git rev by hand.
Reproduction: read the workflow; not executed (would mutate prod).
Fix: add an "Edge Function rollback" row to hotfix.md (checkout previous SHA, `deploy-changed-functions.ts` / `supabase functions deploy <slug> --use-api --import-map`), and make `deploy` wait for the staging PR Check success (`workflow_run` or `needs`) so a red commit never ships. Pin: workflow lint test asserting `deploy` depends on a check.

### A7-OPS-03 | HIGH (launch gate for charging real users) | CONFIRMED | Legally required subscription confirmation email cannot reach customers and its failure is invisible
Evidence: `lib/email/resend.ts:5-12` comment + `SEND_FROM = 'Fresco <onboarding@resend.dev>'` ("real customers will not receive this email until a domain is bought and verified"); `lib/billing/grant-pro.ts:118` failure only `console.error`, no Sentry capture, no retry/outbox. Purpose is TRLGDCU art. 98.7 (comment FRESCO-429).
Impact: first paying user is charged with no durable-support confirmation (legal exposure); nobody is alerted because Vercel console logs are not an alert channel.
Status: root cause already known/tracked (domain not bought, FRESCO-886 Blocked, ADR-0021, memory). NEW residual: no Sentry event/alert and no retry queue. Also affects Auth OTP (ADR-0021 Gmail SMTP).
Reproduction: not executable without a real charge (Stripe test mode only, and Resend would reject non-owner recipient).
Fix: `Sentry.captureException` with tag `email: subscription-confirmation` in the catch, plus a `pending_email` row/flag retried by the reconcile cron; hard launch gate: domain verified before live Stripe. Pin: unit test that a rejected send calls the Sentry capture.

### A7-OPS-04 | MEDIUM | PLAUSIBLE | Signup OTP email volume capped by Gmail SMTP and Supabase auth email rate limit (not in ADR-0021)
Evidence: ADR-0021 lines 22-33 (Gmail SMTP sender, burst risk mentioned only as deliverability); `supabase/config.toml:211` local `email_sent = 2`; ADR-0021 has no mention of the hosted `rate_limit.email_sent` value or Gmail's daily send cap. I could not read the hosted Auth config (needs Management API token, not used).
Impact: a launch-day burst (> hosted hourly email cap, Supabase default for custom SMTP is low, and Gmail ~500/day for consumer accounts) makes `/signup` OTP fail for later users; guests lose their generated menu after the 3-day cleanup.
Reproduction: not safe (would send emails). Check hosted Auth > Rate Limits and measure with PostHog `otp_sent` per hour.
Fix: document the hosted values in ADR-0021, add a PostHog alert on `otp_failed` reason `over_email_send_rate_limit`, and raise/replace the sender before launch.

### A7-OPS-05 | LOW | CONFIRMED | Only `stripe-reconcile` has a heartbeat; 4 other pg_cron jobs can stop silently
Evidence: `lib/jobs/heartbeat.ts:28` `MONITORED_JOBS = [STRIPE_RECONCILE_JOB]`. `select jobname from cron.job`: cleanup-abandoned-guest-users, cleanup-expired-rate-limits, retry-posthog-erasures, send-weekly-reengagement-push, stripe-reconcile-subscriptions (all active). `cron.job_run_details` (3 days): all succeeded, last 2026-10-17 03:00/03:15/04:30/04:17 UTC. ADR note in observability.md: `net.http_get` only enqueues, so `succeeded` does not prove the route answered.
Impact: `retry-posthog-erasures` is the GDPR erasure retry; if its route returns 401/500 it silently stops. Others affect storage growth (rate-limit table, guest users) and the weekly push.
Fix: `recordJobHeartbeat` in the three Edge-function jobs + add to MONITORED_JOBS (observability.md "Adding a job"). Pin: test that every `cron.schedule` name in migrations appears in a heartbeat map or an explicit allowlist.

### A7-OPS-06 | INFO | CONFIRMED | Sentry alert rules and Sentry/PostHog/Resend/Vercel quota behaviour are not in the repo
Evidence: observability.md "Sentry: minimum alerts (owner action)" (new issue, spike, payments) are manual dashboard config; `sentry.*.config.ts` `tracesSampleRate: 0.1`, no `sendDefaultPii` (default false). I could not verify the alerts exist or the Sentry free-tier error cap (5k/month). When the cap is hit Sentry drops events silently, so the payments alert would go quiet. PostHog server capture fails closed and is try/caught (`lib/posthog/server.ts:82`).
Fix: record the alert rule IDs in observability.md after verifying in Sentry; add a quota-usage alert (80%).

## 3. Checklist items that found nothing (with evidence)
1. Backups/restore: NO defect. `db-backup.yml` daily 03:17 UTC, encrypted, restore-verified before R2 upload, failure opens an issue; last runs 10-17, 10-16, 10-15 success; ADR-0020 states RPO 24 h, RTO data restore 76 s measured (drill 2026-10-08), runbook + quarterly drill (db-restore-drill.yml). Free plan, no PITR, owner-accepted. Gaps are INFO only: Storage files not backed up but bucket `recipe-photos` has 0 objects (SELECT); whole-recovery RTO (Auth settings, Edge secrets, Vercel env, Stripe webhook) untimed and `BACKUP_PASSPHRASE` copy outside GitHub is unverifiable.
2. Shared-DB blast radius: already known and accepted (ADR-0020, `accepted_divergences admin-bypass-on-promotion`). Migration ledger drift gated on staging push + weekly (`migration-drift-check.yml`), no down-migrations, forward-fix runbook exists (hotfix.md section 5). No workflow applies migrations; ordering vs Edge deploy is manual (known, FRESCO-413).
3. Stripe webhook: NO defect. Signature check, claim by `event.id` in `stripe_webhook_events` (409 while in progress, 500 on claim failure so Stripe retries, release on failure), maxDuration 60, reconcile cron as safety net with heartbeat; prod `/api/health/jobs` returns `{"stripe-reconcile":"ok"}`.
4. Third-party outage: PostHog fail-closed/try-catch, Resend failure does not block subscription (graceful, but see OPS-03).
5. Health endpoints: pre and pro `/api/health` 200 (`app:ok, supabase:ok`, 1.3-2.2 s), `/api/health/jobs` 200. Body leaks nothing (FRESCO-922).
6. Hotfix runbook accuracy: Vercel rollback + `git:promote` steps consistent with promotion.md and project.yaml; only Edge gap (OPS-02).
7. CI/CD: promotion gate, required checks, accepted divergence all documented and consistent; vercel-ignore-build fails open correctly; deployments cap measured in promotion.md.
8. Missing-var behaviour: `RESEND_API_KEY` throws at use, `CRON_SECRET` checked in reconcile route (401, Sentry on missing). Only names inspected.

## 4. Could not verify
- Hosted Supabase Auth rate limits and SMTP config, plan usage (DB size, egress, Edge invocations, MAU), Vercel bandwidth/function duration actuals, Sentry/PostHog/Resend quota usage and Sentry alert rules (no read access without tokens/dashboard; not attempted).
- Whether an external uptime monitor exists; whether R2 lifecycle rule/passphrase copy exist.
- Real runtime of slow routes vs timeouts (no load, no auth session used).

## 5. Hygiene
secrets_materialized: none
cleaned: yes
