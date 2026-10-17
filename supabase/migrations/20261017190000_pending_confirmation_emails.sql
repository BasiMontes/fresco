-- FRESCO-1005 (audit 7b: A7-LAUNCH-01, A7-LAUNCH-02, A7-OPS-03): the subscription confirmation
-- email a consumer must receive (TRLGDCU art. 98.7) used to fail with a console.error and
-- nothing else. The sender is `onboarding@resend.dev`, which Resend delivers only to the account
-- owner while there is no verified domain (FRESCO-886), so every real customer's send is rejected
-- and nobody knows.
--
-- One row per subscription whose confirmation was rejected. `stripe-reconcile` retries the rows
-- that are still under the attempt cap and deletes a row once the send goes through. The row
-- holds ids only: the price, the interval and the dates are read from the live Stripe
-- subscription when the retry runs, so a retry never sends stale numbers.
--
-- Same locked-down shape as stripe_webhook_events: RLS on, zero policies, no client role ever
-- touches it; only the service-role client in the webhook and the cron does. A user-writable
-- flag on user_profiles was rejected on purpose: the audit already asks to take column
-- privileges away (FRESCO-1015), and this would add one.

create table public.pending_confirmation_emails (
  subscription_id  text primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  attempts         integer not null default 1 check (attempts >= 1),
  last_error       text,
  created_at       timestamptz not null default now(),
  last_attempt_at  timestamptz not null default now()
);

comment on table public.pending_confirmation_emails is
  'Subscriptions whose confirmation email was rejected (FRESCO-1005). Retried by stripe-reconcile up to a cap, deleted on success. Written by the service role only.';

alter table public.pending_confirmation_emails enable row level security;
revoke all on public.pending_confirmation_emails from public, anon, authenticated;

-- A new public table gets no data privileges by default, not even for service_role. The grant
-- path inserts, the retry pass selects, updates the attempt and deletes on success.
grant select, insert, update, delete on public.pending_confirmation_emails to service_role;
