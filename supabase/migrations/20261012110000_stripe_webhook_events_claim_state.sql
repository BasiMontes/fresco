-- FRESCO-909 (definitive audit C-03): the Stripe webhook's event claim becomes
-- expirable and recoverable, with an explicit completed state.
--
-- Until now a row meant "taken" forever: if the function died between the claim
-- and the handler's end (timeout, crash, deploy), the row stayed and every
-- re-delivery of that event was answered 200 and skipped, so a paying customer
-- could stay Free. Now a claim carries when it was taken (`claimed_at`) and when
-- the handler finished (`completed_at`); a claim with no completion older than
-- the TTL (lib/billing/webhook-events.ts) is retaken by compare-and-swap on
-- `claimed_at`, which needs UPDATE for the service role.
--
-- Additive and idempotent. `processed_at` stays (deprecated) because code that
-- predates this migration still inserts without the new columns. Existing rows
-- are backfilled as completed (they were all treated as done), but only the first
-- time the columns are created, so re-applying never marks an in-flight claim
-- completed. No RLS or policy change: the table stays closed to client roles.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'stripe_webhook_events' and column_name = 'claimed_at'
  ) then
    alter table public.stripe_webhook_events
      add column claimed_at timestamptz not null default now(),
      add column completed_at timestamptz null;

    update public.stripe_webhook_events
      set claimed_at = processed_at, completed_at = processed_at;
  end if;
end
$$;

comment on column public.stripe_webhook_events.claimed_at is
  'When the webhook last took this event (FRESCO-909). A claim without completed_at older than the TTL can be retaken.';
comment on column public.stripe_webhook_events.completed_at is
  'When the handler finished the event (FRESCO-909). Null while it runs or if the run died.';
comment on column public.stripe_webhook_events.processed_at is
  'Deprecated (FRESCO-909): use claimed_at / completed_at.';

grant select, insert, update, delete on public.stripe_webhook_events to service_role;
