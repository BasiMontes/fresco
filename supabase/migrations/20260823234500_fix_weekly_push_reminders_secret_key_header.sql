-- FRESCO-241 PR3 fix: the original `schedule_weekly_push_reminders`
-- migration sent the caller credential on the `Authorization: Bearer` header
-- -- the legacy `service_role` JWT pattern. This project uses the new-style
-- `sb_secret_...` key (not JWT-based). Per Supabase's own migration guide
-- (`search_docs`, confirmed 2026-08-23): a secret key sent on
-- `Authorization: Bearer` is rejected with "Invalid JWT" -- it must go on
-- the `apikey` header instead, and the platform's `verify_jwt` check does
-- not understand this key type at all, so the target function must be
-- deployed with `verify_jwt: false` (done alongside this migration) and
-- verify the caller itself (`requireServiceRoleCaller` in `_shared/auth.ts`,
-- updated to check `apikey` against `SUPABASE_SECRET_KEYS`).
--
-- `cron.schedule` upserts by job name, so re-running it here with the
-- corrected header replaces the original job in place -- no unschedule step
-- needed.
--
-- ⚠️ ONE-TIME MANUAL STEP required after this migration runs (same
-- constraint as the original migration -- no MCP tool exposes the real key
-- to the AI session, by design): create the vault secret with the actual
-- `sb_secret_...` value, from the Supabase SQL editor (or `execute_sql`):
--
--   select vault.create_secret(
--     '<the real SUPABASE_SECRET_KEY value (sb_secret_...)>',
--     'edge_function_secret_key',
--     'Secret key used by pg_cron to authenticate net.http_post calls to Edge Functions (FRESCO-241)'
--   );
--
-- Until that secret exists, `vault.decrypted_secrets` returns no row for
-- this name and the `apikey` header resolves to an empty string -- the
-- Edge Function's `requireServiceRoleCaller` check rejects that with 401,
-- so the job runs on schedule but each send silently no-ops rather than
-- crashing (same trade-off as the original migration).

select cron.schedule(
  'send-weekly-reengagement-push',
  '0 18 * * 0', -- every Sunday at 18:00 UTC
  $$
  select net.http_post(
    url := 'https://jdqemhewjrjuopssdurn.supabase.co/functions/v1/send-weekly-reengagement-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'edge_function_secret_key'
        limit 1
      )
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- The old placeholder secret (never populated with a real value -- per
-- project confirmation 2026-08-23) is now unused; drop it so it doesn't
-- linger as a misleading "service_role JWT" name.
delete from vault.secrets
where name = 'edge_function_service_role_key';
