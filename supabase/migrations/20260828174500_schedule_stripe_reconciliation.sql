-- FRESCO-301 (ADR-0015): schedules the daily Stripe subscription
-- reconciliation job. This migration only wires up "call
-- /api/cron/stripe-reconcile once a day" -- the real work (fetch each
-- subscription from Stripe, compare to user_profiles, write the drift)
-- lives entirely in the Next.js route.
--
-- WHY a Next.js route and not an Edge Function: all the Stripe -> user_profiles
-- mapping logic (resolveReconciledState + the webhook's resolvers) lives in
-- the Next.js runtime (lib/stripe.ts), unit-tested. An Edge Function would
-- have to re-implement it in Deno -- the exact drift risk this job exists to
-- kill. pg_cron stays the only scheduler (ADR-0011); this is its first
-- net.http call to an external (Vercel) URL rather than a Supabase-internal
-- Edge Function.
--
-- TARGET URL: one Supabase project backs dev/pre/pro and there is one Stripe
-- account, so the job fires ONCE and must hit ONE app URL -- production
-- (fresco-pro.vercel.app), the only always-deployed target. Reconciling
-- against the shared DB is correct regardless of which app deploy serves the
-- request.
--
-- AUTH: Authorization: Bearer <CRON_SECRET>. CRON_SECRET is a plain shared
-- secret (NOT a Supabase key -- so, unlike the weekly-push job, it belongs on
-- the Authorization header and needs no verify_jwt handling). The route
-- checks it directly. Read here at execution time from Supabase Vault, never
-- a literal in this file.
--
-- WARNING: ONE-TIME MANUAL STEPS this migration cannot do:
--
--   1. Vercel: set CRON_SECRET (e.g. `openssl rand -hex 32`) in the
--      Production scope (Preview/Development too, for local + preview manual
--      testing parity).
--
--   2. Supabase Vault: create the secret with the SAME value, from the SQL
--      editor (or execute_sql) -- the real value is deliberately never given
--      to the AI session:
--
--        select vault.create_secret(
--          '<the CRON_SECRET value>',
--          'stripe_reconcile_cron_secret',
--          'Bearer token pg_cron uses to auth GET /api/cron/stripe-reconcile (FRESCO-301)'
--        );
--
--   3. Deploy order: the route must be live in production BEFORE the cron
--      first fires. Merge + prod-deploy the route, then apply this migration.
--
-- Until the Vault secret exists, `vault.decrypted_secrets` returns no row and
-- the Authorization header resolves to `Bearer ` -- the route rejects that
-- with 401, so the job runs on schedule but no-ops rather than crashing.
-- pg_net calls are fire-and-forget async, so cron.job_run_details won't show
-- the HTTP result (ADR-0011 trade-off) -- inspect the reconcile run via
-- Vercel logs / Sentry (ADR-0009).
--
-- CADENCE: 04:17 UTC daily. Off-peak, and deliberately not on the hour to
-- avoid top-of-hour scheduler congestion. Daily is enough: Stripe retries
-- failed deliveries for ~3 days, and there are 0 paying subscribers today --
-- a never-delivered event is recovered within 24h.
--
-- cron.schedule upserts by job name, so re-running this replaces the job in
-- place -- no unschedule step needed.

create extension if not exists pg_net;

select cron.schedule(
  'stripe-reconcile-subscriptions',
  '17 4 * * *', -- every day at 04:17 UTC
  $$
  select net.http_get(
    url := 'https://fresco-pro.vercel.app/api/cron/stripe-reconcile',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || coalesce((
        select decrypted_secret from vault.decrypted_secrets
        where name = 'stripe_reconcile_cron_secret'
        limit 1
      ), '')
    )
  ) as request_id;
  $$
);
