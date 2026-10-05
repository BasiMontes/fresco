-- FRESCO-793 (A6-P7): MVP success bar, measured from the database.
-- "3 of 10 pay AND repeat usage for 3+ consecutive weeks"
-- (.context/PRD/mvp-scope.md -> Success Criteria).
--
-- Source of truth is Postgres, not PostHog: PostHog client events only exist
-- for people who accepted cookies (selection bias), so this query is the
-- consent-independent cross-check. Read-only.
--
-- Run:  supabase db query --linked -f scripts/queries/mvp-success-bar.sql
--
-- Definitions
--   payer      user_profiles.plan in ('pro','family') with a Stripe subscription
--              on file. Caveat: the 7-day trial also sets plan = 'pro', and the
--              table cannot tell trial from paid, so `payers` is an UPPER bound
--              until the first renewal; cross-check the count in the Stripe
--              dashboard (status = active, not trialing).
--   usage week an ISO week (meal_plans.fecha_inicio, a Monday) whose menu has at
--              least one slot marked 'cocinada' (meal_plan_recipes.estado).
--   repeat     3+ usage weeks in a row for the same payer (gaps-and-islands:
--              consecutive Mondays share the same fecha_inicio - n*7 anchor).
with payers as (
  select id
  from public.user_profiles
  where plan in ('pro', 'family')
    and stripe_subscription_id is not null
),
usage_weeks as (
  select distinct mp.user_id, mp.fecha_inicio
  from public.meal_plans mp
  join payers p on p.id = mp.user_id
  join public.meal_plan_recipes r on r.meal_plan_id = mp.id
  where r.estado = 'cocinada'
),
islands as (
  select
    user_id,
    fecha_inicio,
    fecha_inicio - (row_number() over (partition by user_id order by fecha_inicio))::int * 7 as anchor
  from usage_weeks
),
runs as (
  select user_id, count(*) as consecutive_weeks
  from islands
  group by user_id, anchor
)
select
  (select count(*) from payers) as payers,
  count(distinct user_id) filter (where consecutive_weeks >= 3) as payers_repeating_3plus_weeks,
  coalesce(max(consecutive_weeks), 0) as longest_run_weeks,
  now() as measured_at
from runs;
