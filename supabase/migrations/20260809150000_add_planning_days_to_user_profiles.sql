-- Add planning_days column to user_profiles (FRESCO-136: let the user
-- choose which days of the week to plan by default -- e.g. skip Sundays if
-- eating out -- instead of assuming all 7 always). Reuses the existing
-- `dia_semana` enum (meal_plan_recipes' `dia` column type) for consistency.
-- Not null, defaults to all 7 (current behavior preserved for existing rows
-- and new signups who skip this step).

alter table public.user_profiles
  add column planning_days dia_semana[] not null default array[
    'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'
  ]::dia_semana[];

comment on column public.user_profiles.planning_days is
  'Onboarding (FRESCO-136). Which days of the week to plan by default. Defaults to all 7.';
