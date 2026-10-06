# Observability: health, uptime, Sentry release and the minimum alerts

FRESCO-803 (audit-6 A6-D7). Before this, a partial outage (an Edge Function answering 500, the Stripe webhook failing) was noticed only if someone happened to see it, and a Sentry error could not be tied to a deploy.

## What exists in the repo

| Piece | Where | What it does |
|---|---|---|
| Health endpoint | `GET /api/health` (`app/api/health/route.ts`, `lib/health/check-health.ts`) | public, unauthenticated, never cached. `200` when the app answers and Supabase answers a one-row read of the public `recipes` catalog with the anon key; `503` otherwise. Body: `{ status, commit, environment, checks: { app, supabase } }`. It never contains a URL, key or error message |
| Sentry release | `lib/observability/release.ts`, the three SDK inits, `next.config.mjs` | `release` = the first 40 characters of `VERCEL_GIT_COMMIT_SHA`, inlined as `NEXT_PUBLIC_RELEASE` at build so the browser bundle has it too. No release outside Vercel |

The health check is deliberately shallow. It does not call Stripe or the Edge Functions: a monitor hitting them every few minutes would cost real requests. Those failures are covered by the Sentry alerts below.

## Uptime monitor (free, external): owner action

Any free HTTP monitor works; UptimeRobot's free plan (5 minute interval) is enough.

1. New monitor, type HTTP(s), URL `https://fresco-pro.vercel.app/api/health` (production `web_url` in `.agents/project.yaml`), interval 5 minutes, alert when the status is not `200`.
2. Alert contact: the owner's email (the only person on call today).
3. **Drill, to prove it alerts**: create a second monitor on `https://fresco-pro.vercel.app/api/health-drill` (a path that does not exist, so it answers `404`), wait for the "down" email, then delete it. Attach the email or the monitor's event log to the ticket.

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
