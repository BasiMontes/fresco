-- Add sexo and objetivo columns to user_profiles (FRESCO-132: new onboarding
-- step 1 collects nombre, sexo, objetivo -- more signal for recipe
-- recommendations). Both nullable, no default, same pattern as `nombre`
-- (20260802000000) -- empty/unset is valid, existing RLS policies
-- (profiles_select_own / profiles_insert_own / profiles_update_own) already
-- cover the whole row, no new policy or trigger needed.

create type public.sexo_usuario as enum ('mujer', 'hombre', 'otro', 'prefiero_no_decir');

create type public.objetivo_usuario as enum (
  'perder_peso',
  'comer_sano',
  'ahorrar_dinero',
  'ganar_masa_muscular',
  'comer_variado',
  'reducir_desperdicio'
);

alter table public.user_profiles
  add column sexo public.sexo_usuario,
  add column objetivo public.objetivo_usuario;

comment on column public.user_profiles.sexo is
  'Onboarding step 1 (FRESCO-132). Nullable -- optional signal for recipe recommendations.';
comment on column public.user_profiles.objetivo is
  'Onboarding step 1 (FRESCO-132). Nullable -- user goal (lose weight, eat healthy, etc.) used to focus recipe recommendations.';
