-- Code review on FRESCO-228's PR (#100) found: `profiles_update_own` (RLS,
-- 20260725120100_create_fresco_core_tables.sql) is `for update to
-- authenticated using (auth.uid() = id)` with no column restriction, and
-- `grant update on public.user_profiles to authenticated`
-- (20260729120000_grant_authenticated_table_privileges.sql) is table-wide.
-- RLS in Postgres is row-scoped, not column-scoped, so any authenticated
-- user could already call the Supabase client SDK directly
-- (`.from('user_profiles').update({ plan: 'pro' }).eq('id', <own id>)`) and
-- self-grant Pro — this predates this PR, but this PR is the first to attach
-- real Stripe identifiers to that same open surface, and it directly
-- contradicts the invariant ADR-0007 (added in this same PR) declares: the
-- webhook is the ONLY writer of subscription state.
--
-- Fix: a BEFORE UPDATE trigger rejects any change to the four
-- subscription-state columns unless the caller's JWT role is
-- `service_role` (the role the webhook's service-role Supabase client uses
-- — `lib/supabase/service.ts`). RLS policy bypass via service_role does NOT
-- bypass triggers, so this closes the gap without weakening the existing
-- row-ownership policy or touching any other column's updatability
-- (dietary preferences, nombre, etc. are untouched).

create or replace function public.prevent_client_subscription_writes()
returns trigger as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.plan is distinct from old.plan
    or new.plan_expires_at is distinct from old.plan_expires_at
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
  then
    raise exception 'plan/subscription fields are managed by the Stripe webhook only (ADR-0007)';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger protect_subscription_columns
  before update on public.user_profiles
  for each row
  execute function public.prevent_client_subscription_writes();
