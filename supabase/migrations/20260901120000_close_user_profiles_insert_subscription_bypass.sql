-- FRESCO-360 (audit-4 A4-B1): the `protect_subscription_columns` trigger
-- (20260818190000 + 20260819121500) is BEFORE UPDATE only. The INSERT path
-- into `public.user_profiles` was never covered:
--
--   * `authenticated` (which includes anonymous guests, ADR-0003) holds a
--     table-level INSERT grant (20260729120000) and `profiles_insert_own` RLS
--     is row-scoped (`auth.uid() = id`), not column-scoped.
--   * No trigger on `auth.users` pre-creates the profile row — it does not
--     exist until onboarding's `upsertUserProfile` writes it — so an
--     attacker's INSERT is the FIRST write and simply wins.
--
-- Exploit (no app needed): `supabase.auth.signInAnonymously()` with the public
-- anon key, then `POST /rest/v1/user_profiles { id:<uid>, plan:"pro",
-- plan_expires_at:"2099-01-01" }` → permanent Pro with no Stripe subscription.
-- Squat variant: the same INSERT can plant a victim's `stripe_customer_id` /
-- `stripe_subscription_id` (both `text unique`), so the real webhook's later
-- `.update()` hits a unique violation and the paying customer never gets Pro.
--
-- Fix: give `prevent_client_subscription_writes()` an INSERT branch that
-- REJECTS any non-`service_role` INSERT trying to set a subscription-managed
-- column away from its safe default, and re-point the trigger to
-- BEFORE INSERT OR UPDATE. Rejection (not silent coercion) is what the
-- ticket's acceptance criteria call for.
--
-- No grant change: `service_role` already has no INSERT grant here
-- (20260819124500 granted only SELECT/UPDATE), and the only non-test client
-- that inserts — onboarding — never sends any of these columns (`plan`
-- DB-defaults to `'free'`), so legitimate callers are unaffected. Upholds the
-- ADR-0007 invariant: the Stripe webhook is the ONLY writer of subscription
-- state.
--
-- The `session_user` allowlist keeps direct superuser connections (the
-- `scripts/seed-e2e-users.ts` CI/local seed, which writes via `Bun.sql` as
-- `postgres`, and any admin tooling) able to set `plan` on the seed INSERT.
-- `session_user` is the login role and is NOT changed by `SET ROLE`, so a
-- PostgREST request is always `authenticator` here regardless of the JWT
-- role — the `service_role` case still goes through `auth.role()`.

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
  then
    raise exception 'plan/subscription fields are managed by the Stripe webhook only (ADR-0007)';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger protect_subscription_columns on public.user_profiles;

create trigger protect_subscription_columns
  before insert or update on public.user_profiles
  for each row
  execute function public.prevent_client_subscription_writes();
