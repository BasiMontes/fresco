-- FRESCO-199: planning_meals/planning_days (2 independent flat arrays) can't
-- express "skip lunch only on Tuesday" -- they're a whole-week toggle each,
-- with no relationship between them. Replaced by a single day -> meals
-- matrix so meal-plan generation can exclude one specific day+meal slot
-- instead of only a whole meal type across every day, or a whole day.

alter table public.user_profiles
  add column planning_selection jsonb not null default '{
    "lunes": ["desayuno", "comida", "cena"],
    "martes": ["desayuno", "comida", "cena"],
    "miercoles": ["desayuno", "comida", "cena"],
    "jueves": ["desayuno", "comida", "cena"],
    "viernes": ["desayuno", "comida", "cena"],
    "sabado": ["desayuno", "comida", "cena"],
    "domingo": ["desayuno", "comida", "cena"]
  }'::jsonb;

-- Backfill existing rows from the two arrays being dropped below -- every
-- day present in planning_days gets every meal in planning_meals; a day
-- missing from planning_days gets an empty array rather than the
-- just-added column default.
update public.user_profiles
set planning_selection = (
  select coalesce(
    jsonb_object_agg(
      dia::text,
      case when dia = any(planning_days) then to_jsonb(planning_meals) else '[]'::jsonb end
    ),
    '{}'::jsonb
  )
  from unnest(enum_range(null::dia_semana)) as dia
);

alter table public.user_profiles drop column planning_meals;
alter table public.user_profiles drop column planning_days;

comment on column public.user_profiles.planning_selection is
  'FRESCO-199. Which meals (desayuno/comida/cena) to plan, per day of the week -- replaces planning_meals/planning_days (2 flat arrays that could not express a day-specific exclusion, e.g. "no almuerzo los martes").';
