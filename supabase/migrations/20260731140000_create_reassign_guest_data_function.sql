-- FRESCO-20 (ADR-0004): reassigns a guest's generated data to a real,
-- pre-existing account when the email she wants to register with already
-- belongs to that account (FRESCO-19's `email_exists` edge case).
--
-- SECURITY: this crosses a user boundary that no other function in this
-- project does -- it writes rows a caller does not own via `auth.uid()`.
-- EXECUTE is revoked from every ordinary role below; only `service_role` may
-- call it, and only the `reassign-guest-data` Edge Function uses that role,
-- after independently verifying the target account's real password. Never
-- grant this to `authenticated` -- that would let any user reassign any
-- other real user's data to themselves.

create or replace function public.reassign_guest_data(p_from_user_id uuid, p_to_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Reassign meal_plans, skipping any week the target account already has a
  -- plan for (unique_user_semana) -- the target's own existing data wins;
  -- the guest's conflicting week is not force-merged.
  update public.meal_plans mp
  set user_id = p_to_user_id
  where mp.user_id = p_from_user_id
    and not exists (
      select 1 from public.meal_plans existing
      where existing.user_id = p_to_user_id
        and existing.semana_iso = mp.semana_iso
    );

  -- Mirror the reassignment onto shopping_lists (own user_id column, not
  -- derived from meal_plans.user_id at read time) for whichever plans moved.
  update public.shopping_lists sl
  set user_id = p_to_user_id
  where sl.user_id = p_from_user_id
    and sl.meal_plan_id in (
      select id from public.meal_plans where user_id = p_to_user_id
    );

  -- Drop the now-orphaned guest profile. Anything left behind (a week that
  -- conflicted above) cascade-deletes with it -- the target's own data for
  -- that week is the one that survives. The target's own profile (diet,
  -- allergens, etc.) is never touched here.
  delete from public.user_profiles where id = p_from_user_id;
end;
$$;

comment on function public.reassign_guest_data(uuid, uuid) is
  'ADR-0004 (FRESCO-20): moves a guest session''s meal_plans/shopping_lists to a real account and deletes the orphaned guest profile. service_role only -- called exclusively by the reassign-guest-data Edge Function after it verifies the target account''s password.';

revoke execute on function public.reassign_guest_data(uuid, uuid) from public;
revoke execute on function public.reassign_guest_data(uuid, uuid) from anon;
revoke execute on function public.reassign_guest_data(uuid, uuid) from authenticated;
grant execute on function public.reassign_guest_data(uuid, uuid) to service_role;
