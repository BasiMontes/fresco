-- FRESCO-816 (audit-6 A6-S10): one row per Stripe event the webhook has taken.
--
-- Stripe re-delivers an event when the endpoint is slow or answers non-2xx, and
-- anyone can resend one from the dashboard. The writes the webhook makes to
-- user_profiles are absolute and keyed by subscription id, so replaying them is
-- harmless, but two of its analytics events (`trial_converted_to_paid` and
-- `subscription_cancelled`) have no state guard and would be counted twice.
-- `event.id` is the idempotency key: the route claims it with an insert before
-- processing and gives it back if processing fails, so a resend of a failed event
-- still runs.
--
-- Same locked-down shape as rate_limit_endpoints: RLS on, zero policies, no client
-- role ever touches it; only the service-role client in the webhook route does.
-- Rows are tiny and Stripe only re-delivers for a few days; nothing prunes them
-- yet. If the table ever matters for size, delete rows older than 30 days.

create table public.stripe_webhook_events (
  event_id      text primary key,
  event_type    text not null,
  processed_at  timestamptz not null default now()
);

comment on table public.stripe_webhook_events is
  'Stripe event ids the webhook has claimed (FRESCO-816): the idempotency key. Written by the service role only.';

alter table public.stripe_webhook_events enable row level security;
revoke all on public.stripe_webhook_events from public, anon, authenticated;

-- A new public table gets no data privileges by default, not even for service_role
-- (RLS bypass is not a grant). The webhook claims (insert) and releases (delete);
-- select is not used by the route, it is there so an operator on the service role
-- can inspect which events were taken.
grant select, insert, delete on public.stripe_webhook_events to service_role;
