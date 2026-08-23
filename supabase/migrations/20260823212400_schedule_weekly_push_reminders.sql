-- FRESCO-241 PR3 (ADR-0011): schedules the weekly web-push re-engagement
-- send. This migration only wires up "call send-weekly-reengagement-push
-- once a week" -- the real work (who gets a push, what it says, cleanup of
-- dead subscriptions) lives entirely in the Edge Function.
--
-- `pg_net` is Supabase's documented pattern for invoking an Edge Function
-- from `pg_cron` (confirmed via `list_extensions`: available on this
-- project, not yet installed -- `pg_cron` itself is already installed,
-- FRESCO-238 precedent). Unlike that precedent (pure-SQL job, no outbound
-- call), this is the first job that reaches outside the database.
--
-- AUTH: the Authorization header carries this project's own service_role
-- key, read at execution time from Supabase Vault (`supabase_vault`
-- extension, already installed on this project) -- never a literal in this
-- file. This is Supabase's own documented pg_cron + pg_net + Vault pattern
-- (`pg_net: Async Networking` docs, confirmed via search_docs 2026-08-23).
--
-- ⚠️ ONE-TIME MANUAL STEP required after this migration runs, and this
-- migration cannot do it: the actual service_role key value was
-- deliberately never given to the AI session that wrote this (no MCP tool
-- exposes it, by design -- same reasoning as VAPID_PRIVATE_KEY never
-- living in a literal anywhere). Run once, with the real key, from the
-- Supabase SQL editor (or `execute_sql`):
--
--   select vault.create_secret(
--     '<the real SUPABASE_SERVICE_ROLE_KEY value>',
--     'edge_function_service_role_key',
--     'service_role key used by pg_cron to authenticate net.http_post calls to Edge Functions (FRESCO-241)'
--   );
--
-- Until that secret exists, `vault.decrypted_secrets` returns no row for
-- this name and the Authorization header below resolves to `Bearer ` --
-- the Edge Function's own `requireServiceRoleCaller` check rejects that
-- with 401, so the job runs on schedule but each send silently no-ops
-- rather than crashing. Cron run history / failures are inspectable via
-- Edge Function logs (`get_logs`) -- pg_net calls are fire-and-forget async,
-- so `cron.job_run_details` alone won't show the HTTP result (ADR-0011's
-- documented trade-off).
--
-- CADENCE: Sunday 18:00 UTC (20:00 Europe/Madrid CEST in summer, 19:00 CET
-- in winter -- pg_cron runs on UTC, no per-job timezone config; this drifts
-- by an hour across DST, an accepted limitation given AC2 only specifies
-- "tarde/noche", not an exact minute). Sunday evening is deliberate, not
-- "a day after" -- the product habit this nudges is "planificar cada
-- domingo" (TECHDEBT-FRESCO-241), so the reminder needs to land while
-- Sunday is still actionable for a user who hasn't planned yet, not the
-- morning after when the moment has passed.

create extension if not exists pg_net;

select cron.schedule(
  'send-weekly-reengagement-push',
  '0 18 * * 0', -- every Sunday at 18:00 UTC
  $$
  select net.http_post(
    url := 'https://jdqemhewjrjuopssdurn.supabase.co/functions/v1/send-weekly-reengagement-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'edge_function_service_role_key'
        limit 1
      )
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
