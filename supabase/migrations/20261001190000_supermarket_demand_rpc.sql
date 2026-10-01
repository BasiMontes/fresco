-- FRESCO-770 (PR 2b): the query behind the supermarket refresh's `demanda`
-- (ADR-0036, design §6): how many active menu slots need each ingredient.
--
-- Cross-user by design and for the runner only. The refresh runner holds a
-- `service_role` key, and `service_role` deliberately has no table privilege on
-- `meal_plans` (least privilege, granted table by table as needs arose), so the
-- read goes through a function instead of widening that grant.
--
-- RPC authorization (references/rpc-authorization.md, the six questions):
--   1. Needs DEFINER? Yes: it reads every user's menus, which no RLS-scoped
--      role can do, and `service_role` has no grant on the tables. INVOKER with
--      a new `service_role` grant on user data was the alternative; it widens a
--      key that sits in a CI secret, which is worse.
--   2. Can the identity parameter be deleted? There is none. The only
--      parameter is a date.
--   3. Actor bind: not applicable, there is no actor. Access is the EXECUTE
--      grant: revoked from public, anon and authenticated, granted to
--      `service_role` only (same pattern as get_push_subscriptions_without_
--      current_plan, 20260823212347, and reassign_guest_data, ADR-0004).
--   4. What scopes the returned rows? Nothing needs to: it returns aggregates
--      only (an ingredient and a count). No user id, plan id or slot id leaves
--      the function, so there is no per-user row to leak.
--   5. Proof: tests/db/supermarket-demand-rpc.test.ts, against the real
--      database. An authenticated user is refused; service_role gets the counts
--      and the body carries no user data.
--
-- Counts raw recipe spellings ("Ajo" and "ajo" are two rows); the runner
-- normalizes and sums them (lib/grocery/supermarket/demand.ts). Only slots still
-- to buy count: pending or substituted, not cooked, dropped or excluded.

create function public.get_supermarket_demand(p_desde date)
returns table (ingrediente text, huecos bigint)
language sql
stable security definer
set search_path to 'public'
as $function$
  select i.ingrediente, count(distinct s.id) as huecos
  from public.meal_plan_recipes s
  join public.meal_plans p on p.id = s.meal_plan_id
  join public.recipes r on r.id = s.recipe_id
  cross join lateral jsonb_array_elements_text(
    case when jsonb_typeof(r.ingredientes_principales) = 'array' then r.ingredientes_principales else '[]'::jsonb end
  ) as i(ingrediente)
  where p.fecha_inicio >= p_desde
    and s.estado in ('pendiente', 'sustituida')
  group by i.ingrediente
  order by i.ingrediente;
$function$;

comment on function public.get_supermarket_demand(date) is
  'FRESCO-770: menu slots still to buy per ingredient (raw recipe spelling) in plans starting on or after p_desde. Aggregates only, no user data. service_role only -- called by scripts/refresh-supermarket-prices.ts.';

revoke execute on function public.get_supermarket_demand(date) from public, anon, authenticated;
grant execute on function public.get_supermarket_demand(date) to service_role;
