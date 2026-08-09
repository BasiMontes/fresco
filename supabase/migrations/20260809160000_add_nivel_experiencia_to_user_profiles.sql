-- Add nivel_experiencia column to user_profiles (FRESCO-137: cooking
-- experience level -- "cocinillas" -- used to adjust recipe complexity/time
-- in recommendations). Nullable, no default -- unlike planning_meals/days
-- (FRESCO-135/136) this has no safe "assume everything" default; unset
-- means "unknown", not "beginner" or "expert".

create type public.nivel_experiencia_culinaria as enum (
  'aprendiz',
  'novato',
  'intermedio',
  'chef',
  'experto'
);

alter table public.user_profiles
  add column nivel_experiencia public.nivel_experiencia_culinaria;

comment on column public.user_profiles.nivel_experiencia is
  'Onboarding (FRESCO-137). Cooking experience level ("cocinillas"). Nullable -- used to adjust recipe complexity/time in recommendations.';
