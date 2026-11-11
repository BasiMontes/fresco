-- FRESCO-1153 (revisión integral, hallazgo FS-2): the "Sugerencias para ti" carousel of the shopping list and
-- the /favorites page read the person's favourites straight from `recipes`, so they proposed the ingredients
-- of, and listed, recipes the profile rules out: a recipe marked before declaring an allergen, or one retired
-- since. Tapping a listed one opened "no encontrada".
--
-- filter_allowed_recipe_ids(p_recipe_ids) returns which of the given recipes pass the CALLER's current
-- profile. It asks get_filtered_recipes, the single food-safety choke point (ADR-0001), instead of copying its
-- rules, so it can never drift from the catalogue, the menu generator or the substitution check. Only ids
-- leave the database, which keeps the answer small for a list of favourites (get_filtered_recipes itself
-- returns whole recipe rows).
--
-- Authorization (rpc-authorization.md section 4): SECURITY INVOKER and no identity parameter. The function
-- reads auth.uid(), so a caller cannot ask it to answer for somebody else: there is no actor to bind and no
-- row crossing a tenant boundary. `p_recipe_ids` is a list of resources, not an actor claim, and a recipe is
-- public catalogue data. A caller with no profile row, or an anonymous one, gets nothing (fail closed);
-- EXECUTE is revoked from public and anon, as PostgreSQL grants it to PUBLIC by default.

create or replace function public.filter_allowed_recipe_ids(p_recipe_ids uuid[])
returns setof uuid
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select r.id
  from public.get_filtered_recipes(auth.uid()) r
  where r.id = any (coalesce(p_recipe_ids, '{}'::uuid[]));
$$;

comment on function public.filter_allowed_recipe_ids(uuid[]) is
  'FRESCO-1153: which of the given recipe ids pass the calling user''s current profile (allergens, diet, disliked ingredients, active), by asking get_filtered_recipes. SECURITY INVOKER, no identity parameter: it reads auth.uid().';

revoke execute on function public.filter_allowed_recipe_ids(uuid[]) from public, anon;
grant execute on function public.filter_allowed_recipe_ids(uuid[]) to authenticated;
