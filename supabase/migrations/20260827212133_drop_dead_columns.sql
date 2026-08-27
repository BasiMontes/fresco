-- Cleanup of dead schema surface found during the 2026-08-27 business-map
-- regeneration (PR #169 Discovery Gaps).
--
-- 1. `user_profiles.centro_avisos_bienvenida_vista` / `centro_avisos_rutas_descartado`
--    — schema drift: they exist in the DB but NO tracked migration ever
--    created them. They were superseded by `aviso_bienvenida_visto` /
--    `aviso_rutas_descartado` (added properly in 20260818090000 / 20260818100000)
--    when the Centro de Avisos notice-state columns were reshaped. No
--    application code references the `centro_avisos_*` pair (only the
--    generated `lib/supabase/types.ts` picks them up); all 26 rows hold the
--    default `false`.
--
-- 2. `meal_plans.completado` — created in 20260725120100 as
--    `boolean not null default false`, but the `generate-meal-plan` Edge
--    Function's insert never sets it and no read path consumes it. All 26
--    rows are `false`. Vestigial from the original schema draft.

alter table public.user_profiles
  drop column if exists centro_avisos_bienvenida_vista,
  drop column if exists centro_avisos_rutas_descartado;

alter table public.meal_plans
  drop column if exists completado;
