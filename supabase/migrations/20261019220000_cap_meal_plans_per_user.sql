-- FRESCO-1017 (audit 7b A7-ABUSE-04): `meal_plans` had no per-user cap and any year was a valid week
-- (`semana_iso` accepts 0000-W01 to 9999-W53, UNIQUE per user and week), so one account could grow
-- ~530k rows, and every one of them is read by the profile export.
--
-- A row cap rather than a window on the year: it stops the growth without changing the product rule of
-- how far ahead or back a person may plan. 104 is two years of weekly plans; the busiest account today
-- holds 8, and a person at the cap deletes old weeks (or gets the message `generate-meal-plan` shows).
--
-- Same shape as `enforce_recetas_propias_quota` / `enforce_favorites_quota` (FRESCO-799): SECURITY
-- INVOKER, an advisory lock so two parallel inserts of the same user cannot both read `count = 103`
-- and both pass, errcode `check_violation`. `meal_plans` has no client INSERT (FRESCO-777): the rows
-- come from `create_meal_plan` through the service role, and this trigger bounds that path too.
--
-- Not covered on purpose: `reassign_guest_data` moves a guest's plans with an UPDATE, which a BEFORE
-- INSERT trigger does not see. A guest holds at most the same 104, so the worst case is 208 on the
-- account they are folded into, not 530k.

create function public.enforce_meal_plans_quota()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $function$
begin
  perform pg_advisory_xact_lock(hashtextextended('meal_plans:' || new.user_id::text, 0));
  if (select count(*) from public.meal_plans where user_id = new.user_id) >= 104 then
    raise exception 'meal_plans: limit of 104 plans per user reached'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

revoke execute on function public.enforce_meal_plans_quota() from public, anon, authenticated;

create trigger meal_plans_enforce_quota
  before insert on public.meal_plans
  for each row
  execute function public.enforce_meal_plans_quota();
