-- FRESCO-380 (audit-4 A4-M1) — give get_filtered_recipes a stable ORDER BY.
--
-- The function returned `select r.* from recipes r where ...` with no ORDER BY,
-- so row order was whatever the planner produced — free to vary between calls
-- (seq scan vs index, parallel workers, catalog growth). menu-selector.ts
-- picks the FIRST candidate that ties for the best score, so an unordered
-- feed made the "deterministic" engine (ADR-0005) non-reproducible even
-- before the `Math.random()` jitter. `order by r.id` makes the candidate
-- array itself stable; the seeded tie-break jitter (same PR) is the only
-- remaining, and now reproducible, source of run-to-run variation.
--
-- Body is otherwise identical to 20260901073555_allergen_filter_safety_net.sql
-- (the case-insensitive allergen / disliked-ingredient exclusion). `create or
-- replace` keeps the grants set in 20260801010000.

create or replace function public.get_filtered_recipes(p_user_id uuid, p_recipe_id uuid default null::uuid)
returns setof public.recipes
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_profile public.user_profiles;
begin
  if p_user_id <> auth.uid() then
    raise exception 'get_filtered_recipes: caller does not own profile %', p_user_id;
  end if;

  select * into v_profile from public.user_profiles where id = p_user_id;

  return query
  select r.*
  from public.recipes r
  where
    (p_recipe_id is null or r.id = p_recipe_id)
    -- Food-safety critical (FRESCO-361 / A4-B2): compare with lower() on both
    -- sides so an allergen match never depends on the casing a recipe was
    -- tagged with. Fails closed — a recipe stays in only if NONE of its
    -- allergens matches any the user declared.
    and not exists (
      select 1
      from jsonb_array_elements_text(coalesce(r.alergenos, '[]'::jsonb)) as ra(val)
      where lower(ra.val) = any (select lower(a) from unnest(coalesce(v_profile.alergenos, '{}'::text[])) as a)
    )
    and (not v_profile.dieta_vegetariano or coalesce((r.dieta->>'vegetariano')::boolean, false))
    and (not v_profile.dieta_vegano      or coalesce((r.dieta->>'vegano')::boolean, false))
    and (not v_profile.dieta_sin_gluten  or coalesce((r.dieta->>'sin_gluten')::boolean, false))
    and (not v_profile.dieta_sin_lactosa or coalesce((r.dieta->>'sin_lactosa')::boolean, false))
    and (not v_profile.dieta_sin_huevo   or coalesce((r.dieta->>'sin_huevo')::boolean, false))
    and (not v_profile.dieta_keto        or coalesce((r.dieta->>'keto')::boolean, false))
    and (not v_profile.dieta_halal       or coalesce((r.dieta->>'halal')::boolean, false))
    and not exists (
      select 1
      from jsonb_array_elements_text(coalesce(r.ingredientes_principales, '[]'::jsonb)) as ri(val)
      where lower(ri.val) = any (select lower(i) from unnest(coalesce(v_profile.ingredientes_odiados, '{}'::text[])) as i)
    )
  order by r.id;
end;
$function$;
