-- FRESCO-1001 (audit 7b: A7-PAY-01, A7-PAY-03, A7-TEST-03 livemode part), PR 1 of 3: the schema
-- the Stripe mode guard stands on. Nothing reads these objects yet; the guard itself ships in
-- the next PR, and ADR-0061 records the decision.
--
-- Why. Every environment shares one Supabase project and no code reads `livemode`. Once
-- production uses live Stripe keys, `fresco-pre` (test keys, public) still verifies its own
-- webhook secret and writes the shared `user_profiles` row, so a test card on `fresco-pre` makes
-- a production account Pro. A per-deploy check ("the event's mode equals this deploy's key
-- mode") passes on `fresco-pre`, so the mode has to be a fact of the shared database:
--
--   1. `billing_mode`: a one-row table holding the Stripe mode this database serves. Test today.
--      The owner flips it to live ONCE at go-live; from then on test-mode events from
--      `fresco-pre` and `fresco-dev` are refused by every webhook. Same locked-down shape as
--      `stripe_webhook_events`: RLS on, zero policies, no client role ever touches it; only the
--      service-role client in the webhook reads it. Flipped by the owner through
--      `supabase db query --linked` (the Management API runs it as `postgres`), which is why
--      `service_role` gets SELECT and nothing else.
--   2. `user_profiles.stripe_livemode`: the mode of the Stripe customer and subscription on
--      file, stored next to their ids. `null` while there are no ids. A profile never mixes
--      modes. Backfilled to `false` for rows that already hold a customer id: every Stripe
--      object created so far is test mode (live keys are not active yet).
--   3. The column joins the ones a client cannot write (ADR-0007): the webhook is the only
--      writer of subscription state.
--
-- Idempotent where it can be (`if not exists`, guarded backfill). Slots and every other column
-- are untouched.

-- 1. The mode this database serves ------------------------------------------------------------

create table if not exists public.billing_mode (
  singleton       boolean primary key default true check (singleton),
  stripe_livemode boolean not null
);

comment on table public.billing_mode is
  'The Stripe mode this database serves (FRESCO-1001, ADR-0061): false = test, true = live. One row. Every Stripe webhook refuses an event whose livemode differs. The owner flips it to true once at go-live. Read by the service role only.';

insert into public.billing_mode (stripe_livemode) values (false)
on conflict (singleton) do nothing;

alter table public.billing_mode enable row level security;
revoke all on public.billing_mode from public, anon, authenticated;

-- A new public table gets no data privileges by default, not even for service_role (RLS bypass is
-- not a grant). The webhook only reads it.
grant select on public.billing_mode to service_role;

-- 2. The mode of the Stripe objects on a profile ---------------------------------------------------

alter table public.user_profiles
  add column if not exists stripe_livemode boolean;

comment on column public.user_profiles.stripe_livemode is
  'Stripe mode of stripe_customer_id / stripe_subscription_id: false = test, true = live, null = no Stripe ids yet (FRESCO-1001). Written by the webhook only.';

-- Every Stripe object created so far is test mode. Guarded, so a rerun changes nothing.
update public.user_profiles
set stripe_livemode = false
where stripe_customer_id is not null
  and stripe_livemode is null;

-- 3. A client cannot write it -----------------------------------------------------------------------

create or replace function public.prevent_client_subscription_writes()
returns trigger as $$
begin
  if auth.role() = 'service_role'
    or session_user in ('postgres', 'supabase_admin', 'supabase_auth_admin')
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.plan is distinct from 'free'::plan_usuario
      or new.plan_expires_at is not null
      or new.stripe_customer_id is not null
      or new.stripe_subscription_id is not null
      or new.payment_failed_at is not null
      or new.stripe_livemode is not null
    then
      raise exception 'plan/subscription fields are managed by the Stripe webhook only (ADR-0007)';
    end if;

    return new;
  end if;

  -- UPDATE
  if new.plan is distinct from old.plan
    or new.plan_expires_at is distinct from old.plan_expires_at
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    or new.payment_failed_at is distinct from old.payment_failed_at
    or new.stripe_livemode is distinct from old.stripe_livemode
  then
    raise exception 'plan/subscription fields are managed by the Stripe webhook only (ADR-0007)';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;
