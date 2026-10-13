-- FRESCO-947 (follow-up to FRESCO-910, GDPR art. 17): retry the PostHog deletions that failed.
--
-- `delete-account` erases the PostHog person AFTER the auth user is gone. When that call
-- fails the account is deleted anyway and `account_erasures` keeps the row as
-- `posthog = 'failed'` with the id in `pending_posthog_distinct_id`. Nothing retried it, so
-- the person stayed in PostHog until somebody removed it by hand.
--
-- `retry-posthog-erasures` (Edge Function, because the PostHog credentials are Function
-- secrets and Vercel does not have them) runs daily through pg_cron + pg_net (ADR-0011),
-- like `send-weekly-reengagement-push`. It needs two things from the database:
--   * a counter, so a row that keeps failing is retried a bounded number of times instead of
--     forever, and stays visible (it keeps `failed` and its id) once the cap is reached;
--   * `update` on those columns for the service role, and for nothing else.

alter table public.account_erasures
  add column posthog_attempts        integer not null default 0 check (posthog_attempts >= 0),
  add column posthog_last_attempt_at timestamptz;

comment on column public.account_erasures.posthog_attempts is
  'Retries of a failed PostHog deletion made by retry-posthog-erasures (FRESCO-947). Past the cap the row stays failed and the function logs it.';
comment on column public.account_erasures.posthog_last_attempt_at is
  'When retry-posthog-erasures last tried this row; null while it has never been retried.';

-- Column-level on purpose: the sweep may move a row out of `failed` and count attempts, but
-- it cannot rewrite the hash, the Stripe outcome or when the account was erased.
grant update (posthog, pending_posthog_distinct_id, posthog_attempts, posthog_last_attempt_at)
  on public.account_erasures to service_role;

-- Daily, after the Stripe reconciliation (04:17 UTC). Same caller credential as the weekly
-- push: the secret key from Vault goes on the `apikey` header and the function verifies it
-- itself (`requireServiceRoleCaller`). `cron.schedule` upserts by job name.
select cron.schedule(
  'retry-posthog-erasures',
  '30 4 * * *',
  $$
  select net.http_post(
    url := 'https://jdqemhewjrjuopssdurn.supabase.co/functions/v1/retry-posthog-erasures',
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
