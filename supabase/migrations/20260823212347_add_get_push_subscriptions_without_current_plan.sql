-- FRESCO-241 PR3: the business query behind AC2/AC4 ("every push
-- subscription belonging to a user with no meal_plans row for the current
-- ISO week"). Cross-user by design (no auth.uid() scoping) -- this is the
-- send-weekly-reengagement-push Edge Function's own query, run with the
-- service_role client, not a per-user RLS-scoped read.
--
-- `not exists` against meal_plans is index-backed by the existing
-- `unique_user_semana unique (user_id, semana_iso)` constraint
-- (20260725120100_create_fresco_core_tables.sql) -- no new index needed.
--
-- Same least-privilege pattern as reassign_guest_data (ADR-0004,
-- 20260731140000): SECURITY DEFINER to bypass RLS (needed to read across
-- every user), EXECUTE revoked from every ordinary role, granted only to
-- service_role. Never grant this to authenticated/anon -- it would let any
-- caller enumerate every other user's push subscriptions.

create function public.get_push_subscriptions_without_current_plan(p_semana_iso text)
returns setof public.push_subscriptions as $$
  select ps.*
  from public.push_subscriptions ps
  where not exists (
    select 1
    from public.meal_plans mp
    where mp.user_id = ps.user_id
      and mp.semana_iso = p_semana_iso
  );
$$ language sql stable security definer set search_path = public;

comment on function public.get_push_subscriptions_without_current_plan(text) is
  'FRESCO-241 PR3: push_subscriptions rows for users with no meal_plans row for the given ISO week (AC2/AC4). service_role only -- called exclusively by the send-weekly-reengagement-push Edge Function, which computes p_semana_iso itself server-side.';

revoke execute on function public.get_push_subscriptions_without_current_plan(text) from public, anon, authenticated;
grant execute on function public.get_push_subscriptions_without_current_plan(text) to service_role;
