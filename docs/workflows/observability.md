# Observability: health, uptime, Sentry release and the minimum alerts

FRESCO-803 (audit-6 A6-D7). Before this, a partial outage (an Edge Function answering 500, the Stripe webhook failing) was noticed only if someone happened to see it, and a Sentry error could not be tied to a deploy.

## What exists in the repo

| Piece | Where | What it does |
|---|---|---|
| Health endpoint | `GET /api/health` (`app/api/health/route.ts`, `lib/health/check-health.ts`) | public, unauthenticated, never cached. `200` when the app answers and Supabase answers a one-row read of the public `recipes` catalog with the anon key; `503` otherwise. Body: `{ status, checks: { app, supabase } }`. It never contains a URL, key, error message, the deployed commit or the Vercel environment (FRESCO-922) |
| Sentry release | `lib/observability/release.ts`, the three SDK inits, `next.config.mjs` | `release` = the first 40 characters of `VERCEL_GIT_COMMIT_SHA`, inlined as `NEXT_PUBLIC_RELEASE` at build so the browser bundle has it too. No release outside Vercel |

The health check is deliberately shallow. It does not call Stripe or the Edge Functions: a monitor hitting them every few minutes would cost real requests. Those failures are covered by the Sentry alerts below.

## Uptime monitor

**In place: `.github/workflows/uptime-monitor.yml`** (no account needed, the repo is public so the minutes are free). Every 5 minutes it calls `/api/health` on production, retrying 3 times 15 seconds apart. If it still does not answer `200` it opens ONE issue labelled `uptime-failure` (later failures comment on it), and it closes the issue when the probe recovers. GitHub notifies the owner of the new issue.

- **Limit**: GitHub schedules are best-effort, and in practice the workflow starts far less often than its nominal 5 minutes, with gaps of hours (FRESCO-951). It is a backup, not the primary alert: the external monitor below is.
- **Drill**: Actions > Uptime monitor > Run workflow, with `path` set to `/api/health-drill` (does not exist, answers `404`). It opens an issue labelled `uptime-drill`, separate from the real one. Close it by hand afterwards.

### External monitor (the primary alert, owner action)

FRESCO-951. A monitor outside GitHub Actions, so an outage reaches the owner even when GitHub skips its schedule. UptimeRobot's free plan is enough: 5 minute interval, 0 EUR, and its terms of service allow commercial use (read at `uptimerobot.com/terms`, check it again if the plan changes). Any other free HTTP monitor works the same way.

1. New monitor, type HTTP(s), URL `https://fresco-pro.vercel.app/api/health` (production `web_url` in `.agents/project.yaml`), interval 5 minutes, alert when the status is not `200`.
2. Second monitor, same settings, URL `https://fresco-pro.vercel.app/api/health/jobs`. It answers `503` only when the Stripe reconcile cron has not reported for more than 25 h, so it is the external twin of the cron heartbeat monitor below.
3. Alert contact: the owner's email (the owner is the single on-call contact). Confirm the alert channel is email before relying on it; the free plan's channels are not listed on its pricing page.
4. **Drill, to prove it alerts**: create a third monitor on `https://fresco-pro.vercel.app/api/health-drill` (a path that does not exist, so it answers `404`), wait for the "down" email, then delete it. It must arrive in under 10 minutes. Attach the email or the monitor's event log to the ticket.

## Cron heartbeat

FRESCO-915 (definitive audit C-11). The Stripe reconciliation cron (ADR-0015) is the only safety net for lost payments, and `cron.job_run_details` cannot tell you it stopped: `net.http_get` only enqueues, so the table says `succeeded` even when the route answers `401` (a rotated `CRON_SECRET`) or `500`.

| Piece | Where | What it does |
|---|---|---|
| Heartbeat | table `job_heartbeat`, `lib/jobs/heartbeat.ts`, `app/api/cron/stripe-reconcile/route.ts` | the route upserts `last_success_at` for `stripe-reconcile` when a pass gets to the end. Not written when Stripe answered for none of the profiles checked. Closed to every client role; only the service role writes it. |
| Status endpoint | `GET /api/health/jobs` (`app/api/health/jobs/route.ts`) | public, never cached. `200` when each monitored job is `ok` or `pending`, `503` when one is `stale` (no heartbeat for more than 25 h) or the heartbeats cannot be read. The body carries statuses only, no timestamps. |
| Monitor | `.github/workflows/cron-heartbeat-monitor.yml` | scheduled hourly, it calls `/api/health/jobs` on production, retrying 3 times, and opens ONE issue labelled `cron-heartbeat-failure` when it does not answer `200`; it closes the issue when it recovers. GitHub runs it less often than nominal, so the external monitor on the same URL (see above) is the primary alert. |
| Sentry | the reconcile route | a missing `CRON_SECRET` or price id, a failed profile load, a failing row, a failed checkout sweep and a failed heartbeat write are reported with the tag `cron_job: stripe-reconcile`. A wrong secret answers `401` without reporting, so a probe cannot flood Sentry. |

- **Timing**: the cron fires at 04:17 UTC daily, so a healthy heartbeat is about 24 h old. The limit is 25 h and the monitor probes hourly, so a stopped job raises an alert within roughly 26 h of its last success.
- **`pending` is not an alert**: a job that has never reported (the table is new, or the cron has not run since this was deployed) is `pending`. Alerting on it would fire before the first scheduled run. The cost: a job that NEVER works from day one stays `pending`. The first real heartbeat closes that gap.
- **Limit**: GitHub schedules are best-effort, like the uptime monitor above, and the hourly probe runs less often than nominal (FRESCO-951). Treat the 26 h figure as a best case and rely on the external monitor of this URL.
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

1. `curl -i https://fresco-pro.vercel.app/api/health`: the body says whether it is the app or Supabase. It does not say which commit is live (FRESCO-922); for that use `vercel ls` / `vercel inspect` or the Release of a Sentry event (step 2).
2. In Sentry, the event's **Release** is the commit that produced it. If the errors start at the release of the latest deploy, roll back (`vercel rollback`, see the `vercel-cli` skill) and investigate afterwards.
3. Supabase down: check status.supabase.com and the project's dashboard before touching the app.
4. Stripe webhook failing: Stripe dashboard > Developers > Webhooks > recent deliveries shows the response our route gave.

## Checking the release (after the first deploy with this change)

Any error from production in Sentry shows `Release: <40-character commit>`; compare it with the commit of the latest production deployment in `vercel ls`. `/api/health` no longer reports the commit (FRESCO-922). If an event shows no release, the build did not receive `VERCEL_GIT_COMMIT_SHA`: check Project Settings > Environment Variables > "Automatically expose System Environment Variables".

## Public surface left open on purpose (FRESCO-922)

The 2026-10-12 audit (C-20, C-21, C-25 and an optional note on the catalog) listed four things reachable without a session. Each has either a change or a decision, recorded here so the next audit does not reopen it without new facts. Decided with the founder on 2026-10-14.

| Surface | State | Why | Revisit when |
|---|---|---|---|
| `GET /api/health` | **Changed.** The body is `{ status, checks }`; the commit and the Vercel environment are gone. | They told anyone which build was live and nothing reads them: both monitors read the status code only. | Never needed again unless a monitor must read the commit; then add a token, do not put it back in the public body. |
| `/qa` (`app/qa/page.tsx`) | **Kept public.** It already has `robots: { index: false, follow: false }` (FRESCO-395) and renders `<PROJECT_REF>` instead of the real project ref. No redirect in production. | It is a public surface by design: the page exists so an external evaluator can test Fresco without help from the team. The `@smoke` scenario "La guía de testeabilidad en /qa es pública…" and the production warm-up in `.github/workflows/post-deploy-smoke.yml` both request it, so a production redirect would turn the post-deploy smoke red on every promotion. | The evaluator use ends, or the page starts to carry anything not meant for a stranger (credentials, real project identifiers). |
| `POST /api/waitlist` | **No captcha and no rate limit, for now.** | The table is insert-only for the browser roles: the column grant is `(email, consent_version)`, `id` and `created_at` belong to the database, the address is unique on `lower(email)` with a length check, and `anon` can never read, change or delete a row (`supabase/migrations/20261011140000_waitlist_signups.sql`). The worst case is junk rows in a list that holds no personal data beyond an email, not exposure of anything. Adding a captcha means a new Turnstile secret in Vercel, server-side verification and a widget in the landing form; a per-IP cap in serverless needs a table of its own. | Before the public launch (epic FRESCO-884), or the first time the row count or the junk ratio looks wrong. |
| `recipes` readable by `anon` | **Kept.** | It is the shared, founder-curated catalog, not user data (ADR-0032), and `/api/health` probes Supabase with a one-row read of it using the anon key, so closing it would also take the uptime monitor down. | Recipe content becomes part of the paid plan. |

## Card-less trial and alias accounts (FRESCO-923)

Audit C-22 (BAJO): the card-less trial is once per account (`lib/legal/pro-terms.ts`, FRESCO-778), but a new `name+anything@gmail.com` is a new account and gets another 7 days of Pro. Decided with the founder on 2026-10-14.

| Question | Decision | Why |
|---|---|---|
| Ask for a card to start the trial? | **No, for now.** | Pro value is narrow (4 `isPro` gates in `generate-meal-plan`), so an abused trial costs little. A card wall would cut legitimate sign-ups before launch. |
| How do we watch it? | `trial_started` carries `email_domain` and `email_plus_alias` | Server-side, from `lib/billing/grant-pro.ts` via `lib/billing/trial-email-signals.ts`. The address is never sent; the domain is kept only for public providers (gmail, outlook, hotmail, yahoo, icloud, proton), else `other`. |
| When do we revisit? | More than **20 %** of `trial_started` with `email_plus_alias = true`, over at least **30** trials in the period | Below that the `+` alias is normal use (many people filter mail with it). Review monthly. |

**PostHog query** (SQL insight, last 30 days):

```sql
select properties.email_domain as domain,
       count() as trials,
       countIf(properties.email_plus_alias = true) as aliased
from events
where event = 'trial_started' and timestamp > now() - interval 30 day
group by domain
order by trials desc
```

Events from before 2026-10-14 lack both properties. If the threshold is crossed, the options are a card at trial start (Stripe `payment_method_collection: 'always'` in `/api/stripe/checkout`) or blocking `+` aliases on first trial; both are a product decision.

## Login widget check (Turnstile on `/login`)

FRESCO-1016 (A7-TEST-06). Nothing else in CI renders the Turnstile widget: the local stack has no captcha, the e2e job blanks the site key and the post-deploy smoke gets its session from the admin API. `.github/workflows/login-widget-check.yml` loads the real `/login` of staging in Chromium once a day, with no credentials, and fails unless the widget rendered (a `cf-turnstile-response` input in `captcha_widget`, or a Cloudflare iframe). It opens ONE issue labelled `login-widget-failure` (later failures comment on it) and closes it when the widget is back.

- **Run it by hand**: Actions > Login widget check > Run workflow, with `url` set to production before a launch; or `bun scripts/check-login-widget.ts https://fresco-pro.vercel.app` locally.
- **What to check first when it fails**: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in the Vercel scope of that environment, the Content-Security-Policy in `proxy.ts` (`script-src`, `frame-src`, `connect-src` for `challenges.cloudflare.com`), and the Turnstile site in the Cloudflare dashboard.
- **Limits**: GitHub schedules are best-effort. A passed check does not prove a person can solve a challenge, only that the widget is there and Cloudflare is not blocked.

