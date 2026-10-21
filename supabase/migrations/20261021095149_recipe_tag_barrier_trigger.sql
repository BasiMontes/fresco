-- FRESCO-1020, slice 2 of 2: a recipe that is ACTIVE cannot be saved while its allergen or diet tags
-- contradict its own text. Slice 1 (20261021094055) added `recipe_tag_findings`, the SQL twin of the
-- TypeScript oracle; this slice calls it from a trigger. Until now those rules ran only in CI over the seed
-- and in a nightly audit of the hosted catalogue, so a recipe written straight to the hosted database, or
-- reactivated, reached users with wrong tags until the next night (the allergen filter is a plain tag
-- comparison, so a missing tag serves the recipe to the person who declared the allergy).
--
-- Mechanism, and why not the alternatives (ADR-0064):
--   * A TRIGGER, not a CHECK constraint. PostgreSQL evaluates every CHECK on every UPDATE of a row, whichever
--     column changed, and `recipes` is updated often (learning counters, photos, last-in-menu date). The
--     trigger fires only when a column the rules read is written: BEFORE INSERT OR UPDATE OF alergenos, dieta,
--     ingredientes_principales, pasos_resumen, activo.
--   * It only guards ACTIVE rows (`new.activo`). An inactive recipe is a draft and can be saved half-finished;
--     the barrier acts the moment it is published, which covers inserting an active recipe, editing an
--     active one and reactivating an inactive one.
--   * It rejects with SQLSTATE 23514 (check_violation) and a message that names the recipe and lists one line
--     per broken rule with the same key the oracle uses (`falta:gluten`, `dieta:keto`), so the error says
--     which rule is broken and why.
--
-- Every ACTIVE recipe of the hosted catalogue and of the seed passes (checked before this was written: the
-- only recipes with findings are 7 inactive ones, which stay saveable but cannot be reactivated until fixed).
-- Order of migrations matters: this trigger is created after every earlier migration that rewrites tags, so
-- those still run unobstructed on a reset; the seed loads after it and is already coherent.
--
-- The trigger function is SECURITY INVOKER. The findings function is executable by service_role (and the
-- owner roles); no other role writes these columns.

create or replace function public.enforce_recipe_tag_coherence()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_broken text;
begin
  if new.activo is not true then
    return new;
  end if;

  select string_agg('  - ' || f.rule || ': ' || f.detail, E'\n' order by f.rule, f.detail)
    into v_broken
  from public.recipe_tag_findings(new.alergenos, new.dieta, new.ingredientes_principales, new.pasos_resumen) as f;

  if v_broken is not null then
    raise exception E'La receta "%" no puede guardarse activa: sus etiquetas contradicen su texto.\n%', new.nombre, v_broken
      using errcode = 'check_violation',
            hint = 'Corrige alergenos o dieta, o el texto de la receta, o guárdala inactiva (activo = false).';
  end if;

  return new;
end
$fn$;

comment on function public.enforce_recipe_tag_coherence() is
  'FRESCO-1020 / ADR-0064. Rejects an ACTIVE recipe whose allergen or diet tags contradict its text, naming each broken rule (check_violation).';

revoke execute on function public.enforce_recipe_tag_coherence() from public, anon, authenticated;

drop trigger if exists recipes_tag_coherence on public.recipes;
create trigger recipes_tag_coherence
  before insert or update of alergenos, dieta, ingredientes_principales, pasos_resumen, activo
  on public.recipes
  for each row
  execute function public.enforce_recipe_tag_coherence();
