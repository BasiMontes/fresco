-- Add planning_meals column to user_profiles (FRESCO-135: let the user
-- choose which meals to plan by default -- Desayuno/Almuerzo/Cena --
-- instead of assuming all 3 always). Reuses the existing `tipo_plato` enum
-- (meal_plan_recipes' slot type) for consistency -- "Almuerzo" in the UI
-- maps to the DB's `comida` value. Not null, defaults to all 3 (current
-- behavior preserved for existing rows and new signups who skip this step).

alter table public.user_profiles
  add column planning_meals tipo_plato[] not null default array['desayuno', 'comida', 'cena']::tipo_plato[];

comment on column public.user_profiles.planning_meals is
  'Onboarding (FRESCO-135). Which meals to plan by default. Defaults to all 3 (desayuno/comida/cena) -- snack excluded, not offered as a chip.';
