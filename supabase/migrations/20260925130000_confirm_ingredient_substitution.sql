-- FRESCO-534 (EPIC-FRESCO-714): per-slot ingredient substitution storage +
-- confirmation RPC. Builds on FRESCO-715's catalog/safety-check
-- (get_safe_ingredient_substitutes, ADR-0032). See ADR-0033.
--
-- Storage: a single nullable jsonb column on meal_plan_recipes, never a new
-- table, never a mutation of `recipes` -- one substitution per slot (the
-- story's own scope: no multi-ingredient substitution), applies to exactly
-- the household's own planned meal, never the shared catalog recipe.
--
-- RPC authorization (ADR-0033, references/rpc-authorization.md): SECURITY
-- INVOKER, no caller-supplied identity parameter. `p_slot_id` is a resource
-- reference, not an actor claim -- ownership is enforced by the EXISTING
-- `mpr_update_own` RLS policy on the UPDATE statement itself. A slot that
-- isn't the caller's affects 0 rows (non-disclosing "not found"), never an
-- RLS bypass to guard against.

-- -- 1. Storage column ---------------------------------------------------------

alter table public.meal_plan_recipes
  add column sustitucion_ingrediente jsonb null;

comment on column public.meal_plan_recipes.sustitucion_ingrediente is
  'Per-slot ingredient substitution, shape { "original": text, "sustituto": text }. Never mutates recipes.';

-- -- 2. Confirmation RPC --------------------------------------------------------

create function public.confirm_ingredient_substitution(
  p_slot_id uuid,
  p_ingrediente_original text,
  p_ingrediente_sustituto text
)
returns void
language plpgsql
security invoker
set search_path to 'public'
as $function$
declare
  v_updated integer;
begin
  -- Step 0 (defense in depth, before any write): the candidate must be
  -- CURRENTLY safe for the caller's own profile -- re-checks live, since the
  -- candidate list the UI showed may be stale if the profile changed
  -- mid-session. This also implicitly confirms p_ingrediente_original has at
  -- least one catalog entry.
  if not exists (
    select 1
    from public.get_safe_ingredient_substitutes(p_ingrediente_original) s
    where s.ingrediente_sustituto = p_ingrediente_sustituto
  ) then
    raise exception 'confirm_ingredient_substitution: candidate is not a currently safe substitute'
      using errcode = 'P0001';
  end if;

  -- The original ingredient must actually be part of the slot's own recipe --
  -- rejects a request naming an ingredient that isn't even in that recipe.
  -- Terminal-state guard mirrors update-recipe-status: no substitution once
  -- the slot is cocinada / descartada / excluida (nothing left to plan).
  update public.meal_plan_recipes mpr
  set sustitucion_ingrediente = jsonb_build_object(
    'original', p_ingrediente_original,
    'sustituto', p_ingrediente_sustituto
  )
  from public.recipes r
  where mpr.id = p_slot_id
    and mpr.recipe_id = r.id
    and mpr.estado not in ('cocinada', 'descartada', 'excluida')
    and exists (
      select 1
      from jsonb_array_elements_text(coalesce(r.ingredientes_principales, '[]'::jsonb)) as ri(val)
      where lower(ri.val) = lower(p_ingrediente_original)
    );

  get diagnostics v_updated = row_count;

  -- RLS (mpr_update_own) already scoped the UPDATE to the caller's own slot,
  -- so 0 rows means: slot doesn't exist, isn't the caller's, the ingredient
  -- isn't in that recipe, or the slot is terminal -- one non-disclosing
  -- "not found" for all four, matching the same-error-as-not-found principle.
  if v_updated = 0 then
    raise exception 'confirm_ingredient_substitution: slot not found or not eligible for substitution'
      using errcode = 'P0001';
  end if;
end;
$function$;

grant execute on function public.confirm_ingredient_substitution(uuid, text, text) to authenticated;
