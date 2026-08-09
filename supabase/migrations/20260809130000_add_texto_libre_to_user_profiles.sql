-- Add 4 free-text columns to user_profiles (FRESCO-133: onboarding chip
-- groups don't cover everything -- let the user write what's missing per
-- group). All nullable, no default, same pattern as `nombre`
-- (20260802000000) -- empty/unset is valid, existing RLS policies
-- (profiles_select_own / profiles_insert_own / profiles_update_own) already
-- cover the whole row, no new policy or trigger needed.

alter table public.user_profiles
  add column dieta_texto_libre text,
  add column alergenos_texto_libre text,
  add column ingredientes_odiados_texto_libre text,
  add column cocinas_texto_libre text;

comment on column public.user_profiles.dieta_texto_libre is
  'Onboarding step 2 (FRESCO-133). Free-text note for diet/restrictions not covered by the predefined chips.';
comment on column public.user_profiles.alergenos_texto_libre is
  'Onboarding step 2 (FRESCO-133). Free-text note for allergens not covered by the predefined chips.';
comment on column public.user_profiles.ingredientes_odiados_texto_libre is
  'Onboarding step 2 (FRESCO-133). Free-text note for disliked ingredients not covered by the predefined chips.';
comment on column public.user_profiles.cocinas_texto_libre is
  'Onboarding step 3 (FRESCO-133). Free-text note for favorite cuisines not covered by the predefined chips.';
