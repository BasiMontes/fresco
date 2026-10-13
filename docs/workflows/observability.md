# Observability: health, uptime, Sentry release and the minimum alerts

FRESCO-803 (audit-6 A6-D7). Before this, a partial outage (an Edge Function answering 500, the Stripe webhook failing) was noticed only if someone happened to see it, and a Sentry error could not be tied to a deploy.

## What exists in the repo

| Piece | Where | What it does |
|---|---|---|
| Health endpoint | `GET /api/health` (`app/api/health/route.ts`, `lib/health/check-health.ts`) | public, unauthenticated, never cached. `200` when the app answers and Supabase answers a one-row read of the public `recipes` catalog with the anon key; `503` otherwise. Body: `{ status, commit, environment, checks: { app, supabase } }`. It never contains a URL, key or error message |
| Sentry release | `lib/observability/release.ts`, the three SDK inits, `next.config.mjs` | `release` = the first 40 characters of `VERCEL_GIT_COMMIT_SHA`, inlined as `NEXT_PUBLIC_RELEASE` at build so the browser bundle has it too. No release outside Vercel |

The health check is deliberately shallow. It does not call Stripe or the Edge Functions: a monitor hitting them every few minutes would cost real requests. Those failures are covered by the Sentry alerts below.

## Uptime monitor

**In place: `.github/workflows/uptime-monitor.yml`** (no account needed, the repo is public so the minutes are free). Every 5 minutes it calls `/api/health` on production, retrying 3 times 15 seconds apart. If it still does not answer `200` it opens ONE issue labelled `uptime-failure` (later failures comment on it), and it closes the issue when the probe recovers. GitHub notifies the owner of the new issue.

- **Limit**: GitHub schedules are best-effort. A run can start late or be skipped, so this is a floor, not a guarantee. Add the external monitor below for a stronger one.
- **Drill**: Actions > Uptime monitor > Run workflow, with `path` set to `/api/health-drill` (does not exist, answers `404`). It opens an issue labelled `uptime-drill`, separate from the real one. Close it by hand afterwards.

### External monitor (optional, owner action)

Any free HTTP monitor works; UptimeRobot's free plan (5 minute interval) is enough.

1. New monitor, type HTTP(s), URL `https://fresco-pro.vercel.app/api/health` (production `web_url` in `.agents/project.yaml`), interval 5 minutes, alert when the status is not `200`.
2. Alert contact: the owner's email (the only person on call today).
3. **Drill, to prove it alerts**: create a second monitor on `https://fresco-pro.vercel.app/api/health-drill` (a path that does not exist, so it answers `404`), wait for the "down" email, then delete it. Attach the email or the monitor's event log to the ticket.

## Cron heartbeat

FRESCO-915 (definitive audit C-11). The Stripe reconciliation cron (ADR-0015) is the only safety net for lost payments, and `cron.job_run_details` cannot tell you it stopped: `net.http_get` only enqueues, so the table says `succeeded` even when the route answers `401` (a rotated `CRON_SECRET`) or `500`.

| Piece | Where | What it does |
|---|---|---|
| Heartbeat | table `job_heartbeat`, `lib/jobs/heartbeat.ts`, `app/api/cron/stripe-reconcile/route.ts` | the route upserts `last_success_at` for `stripe-reconcile` when a pass gets to the end. Not written when Stripe answered for none of the profiles checked. Closed to every client role; only the service role writes it. |
| Status endpoint | `GET /api/health/jobs` (`app/api/health/jobs/route.ts`) | public, never cached. `200` when each monitored job is `ok` or `pending`, `503` when one is `stale` (no heartbeat for more than 25 h) or the heartbeats cannot be read. The body carries statuses only, no timestamps. |
| Monitor | `.github/workflows/cron-heartbeat-monitor.yml` | every hour it calls `/api/health/jobs` on production, retrying 3 times, and opens ONE issue labelled `cron-heartbeat-failure` when it does not answer `200`; it closes the issue when it recovers. |
| Sentry | the reconcile route | a missing `CRON_SECRET` or price id, a failed profile load, a failing row, a failed checkout sweep and a failed heartbeat write are reported with the tag `cron_job: stripe-reconcile`. A wrong secret answers `401` without reporting, so a probe cannot flood Sentry. |

- **Timing**: the cron fires at 04:17 UTC daily, so a healthy heartbeat is about 24 h old. The limit is 25 h and the monitor probes hourly, so a stopped job raises an alert within roughly 26 h of its last success.
- **`pending` is not an alert**: a job that has never reported (the table is new, or the cron has not run since this was deployed) is `pending`. Alerting on it would fire before the first scheduled run. The cost: a job that NEVER works from day one stays `pending`. The first real heartbeat closes that gap.
- **Limit**: GitHub schedules are best-effort, like the uptime monitor above. A floor, not a guarantee.
- **Drill**: Actions > Cron heartbeat monitor > Run workflow, with `path` set to `/api/health/jobs-drill` (does not exist, answers `404`). It opens an issue labelled `cron-heartbeat-drill`, separate from the real one. Close it by hand afterwards.
- **If it fires**: open `https://fresco-pro.vercel.app/api/health/jobs`. `stale` means the cron stopped or never gets past authentication: check `CRON_SECRET` in the Vercel Production scope against the Supabase Vault secret the `pg_cron` job sends, and Sentry for events tagged `cron_job: stripe-reconcile`. `unknown` means the heartbeats could not be read: check Supabase.
- **Adding a job**: write its heartbeat with `recordJobHeartbeat(client, 'job-name')` and add the name to `MONITORED_JOBS` in `lib/jobs/heartbeat.ts`.

## Sentry: minimum alerts (owner action)

Project settings > Alerts, environment `production`, notify the owner by email:

| Alert | Condition | Why |
|---|---|---|
| New issue | "A new issue is created" | the first sign of a regression from a deploy |
| Spike | an issue seen more than 10 times in 1 hour | a known error that suddenly matters |
| Payments | an issue whose `transaction` is `/api/stripe/webhook` or `/api/stripe/checkout`, any occurrence | a failing webhook means a customer paid and was not upgraded |

The Edge Functions report to the same Sentry project from Deno (`SENTRY_DSN`, `SENTRY_ENVIRONMENT`). Check one real event first to see which `transaction` names they use, then add an alert on them: that name was not verified here.

## When an alert fires

1. `curl -i https://fresco-pro.vercel.app/api/health`: the body says whether it is the app or Supabase, and which commit is live.
2. In Sentry, the event's **Release** is the commit that produced it. If the errors start at the release of the latest deploy, roll back (`vercel rollback`, see the `vercel-cli` skill) and investigate afterwards.
3. Supabase down: check status.supabase.com and the project's dashboard before touching the app.
4. Stripe webhook failing: Stripe dashboard > Developers > Webhooks > recent deliveries shows the response our route gave.

## Checking the release (after the first deploy with this change)

Any error from production in Sentry shows `Release: <40-character commit>`, and the same commit starts with the 7 characters `/api/health` reports as `commit`. If an event shows no release, the build did not receive `VERCEL_GIT_COMMIT_SHA`: check Project Settings > Environment Variables > "Automatically expose System Environment Variables".
