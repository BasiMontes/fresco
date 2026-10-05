-- FRESCO-799 (audit-6 A6-S7): client writes had no quotas, no size caps, and a
-- rate limit the caller could configure.
--
-- Anonymous sign-in is free and unattended (ADR-0003), so every per-user limit
-- is only as strong as the cost of a new user. This migration bounds what ONE
-- user can store and removes the caller's control over the rate limiter. The
-- other half (a captcha on anonymous / sign-up so new users are not free) ships
-- separately, in `supabase/config.toml` + the sign-in forms.
--
--   1. Size and length CHECKs on the client-writable text/jsonb columns of
--      `recetas_propias`, `shopping_lists` and `meal_plans`.
--   2. Per-user row quotas (trigger) on `recetas_propias` and `favorites`.
--      `push_subscriptions` already has its cap of 10 (FRESCO-779); `meal_plans`
--      and `meal_plan_recipes` have no client INSERT (FRESCO-777); a
--      `shopping_lists` row needs an owned `meal_plan_id` and is unique per plan.
--   3. `check_and_increment_rate_limit` only accepts endpoints registered in
--      `public.rate_limit_endpoints`, and clamps the caller's `p_limit` to the
--      registered ceiling. Before, any signed-in caller could pass a fresh
--      `p_endpoint` (a new counter, i.e. an unlimited budget) or `p_limit` of
--      1000000. A new rate-limited function now needs one row here.
--
-- Production holds none of the offending data (checked read-only before this
-- migration: 0 `recetas_propias`, at most 4 favourites per user, the largest
-- `shopping_lists.items` is ~10 KB, `advertencias` is empty), so the
-- constraints are added validated.
--
-- Sizes use the LOGICAL length (`octet_length` of the text form), not
-- `pg_column_size`: a large, repetitive value compresses to a few KB on disk and
-- would slip under a physical-size cap while still costing bandwidth on every read.

-- ─── 1. Size and length caps ────────────────────────────────────────────────

alter table public.recetas_propias
  add constraint recetas_propias_nombre_max_length
    check (char_length(nombre) <= 120),
  add constraint recetas_propias_ingredientes_bounds
    check (cardinality(ingredientes) <= 60
      and octet_length(array_to_string(ingredientes, ' ')) <= 6000),
  add constraint recetas_propias_pasos_bounds
    check (cardinality(pasos) <= 40
      and octet_length(array_to_string(pasos, ' ')) <= 12000);

alter table public.shopping_lists
  add constraint shopping_lists_items_bounds
    check (jsonb_typeof(items) = 'array' and octet_length(items::text) <= 100000);

alter table public.meal_plans
  add constraint meal_plans_advertencias_bounds
    check (cardinality(advertencias) <= 20
      and octet_length(array_to_string(advertencias, ' ')) <= 4000);

-- ─── 2. Per-user row quotas ─────────────────────────────────────────────────
-- SECURITY INVOKER: the caller's RLS-scoped SELECT already sees every row for
-- `new.user_id` (always their own). The advisory lock serialises concurrent
-- inserts of the same user, so two parallel requests cannot both read
-- `count = limit - 1` and both pass.

create function public.enforce_recetas_propias_quota()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $function$
begin
  perform pg_advisory_xact_lock(hashtextextended('recetas_propias:' || new.user_id::text, 0));
  if (select count(*) from public.recetas_propias where user_id = new.user_id) >= 200 then
    raise exception 'recetas_propias: limit of 200 recipes per user reached'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

create function public.enforce_favorites_quota()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $function$
begin
  perform pg_advisory_xact_lock(hashtextextended('favorites:' || new.user_id::text, 0));
  if (select count(*) from public.favorites where user_id = new.user_id) >= 1000 then
    raise exception 'favorites: limit of 1000 favourites per user reached'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

revoke execute on function public.enforce_recetas_propias_quota() from public, anon, authenticated;
revoke execute on function public.enforce_favorites_quota() from public, anon, authenticated;

create trigger recetas_propias_enforce_quota
  before insert on public.recetas_propias
  for each row
  execute function public.enforce_recetas_propias_quota();

create trigger favorites_enforce_quota
  before insert on public.favorites
  for each row
  execute function public.enforce_favorites_quota();

-- ─── 3. Rate-limit endpoint allowlist ───────────────────────────────────────
-- Same locked-down shape as `rate_limits` / `rate_limit_exempt_users`: RLS on,
-- zero policies, no client role ever touches it; the DEFINER function reads it.

create table public.rate_limit_endpoints (
  endpoint      text primary key,
  max_per_hour  int  not null check (max_per_hour > 0)
);

comment on table public.rate_limit_endpoints is
  'Endpoints check_and_increment_rate_limit accepts, with the ceiling a caller-supplied p_limit is clamped to (FRESCO-799). One row per rate-limited function or route.';

alter table public.rate_limit_endpoints enable row level security;
revoke all on public.rate_limit_endpoints from public, anon, authenticated;

-- Ceilings equal the limits each call site passes today, so behaviour for
-- legitimate traffic does not change. Call sites: the Edge Functions
-- (`enforceRateLimit`), `app/api/stripe/checkout/route.ts`, and
-- `swap_meal_plan_slots` (SQL, 20260928180000) — a SQL caller is easy to miss
-- when grepping TypeScript only.
insert into public.rate_limit_endpoints (endpoint, max_per_hour) values
  ('generate-meal-plan',   5),
  ('update-recipe-status', 60),
  ('reassign-guest-data',  5),
  ('delete-account',       5),
  ('stripe-checkout',      10),
  ('swap_meal_plan_slots', 120);

-- Same signature and body as 20260830142702 except for the registry lookup.
-- The actor bind stays at step 0, before any table read.
create or replace function public.check_and_increment_rate_limit(
  p_user_id        uuid,
  p_endpoint       text,
  p_limit          int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz := date_trunc('hour', now());
  v_max          int;
  v_limit        int;
  v_count        int;
begin
  if p_window_seconds <> 3600 then
    raise exception 'check_and_increment_rate_limit: only 3600s windows supported in v1, got %', p_window_seconds;
  end if;

  if p_user_id <> auth.uid() then
    raise exception 'check_and_increment_rate_limit: caller does not own user_id %', p_user_id;
  end if;

  select e.max_per_hour into v_max
  from public.rate_limit_endpoints e
  where e.endpoint = p_endpoint;

  if v_max is null then
    raise exception 'check_and_increment_rate_limit: unknown endpoint %', p_endpoint;
  end if;

  v_limit := least(p_limit, v_max);

  -- e2e / smoke test accounts stay exempt (FRESCO-310). Checked after the
  -- endpoint so a typo in a call site is still caught on those accounts.
  if exists (
    select 1 from public.rate_limit_exempt_users e where e.user_id = p_user_id
  ) then
    return true;
  end if;

  insert into public.rate_limits (user_id, endpoint, window_start, count)
  values (p_user_id, p_endpoint, v_window_start, 1)
  on conflict (user_id, endpoint, window_start)
  do update set
    count      = public.rate_limits.count + 1,
    updated_at = now()
  where public.rate_limits.count < v_limit
  returning count into v_count;

  if v_count is null then
    return false;
  end if;

  return true;
end;
$$;

revoke execute on function public.check_and_increment_rate_limit(uuid, text, int, int) from public, anon;
