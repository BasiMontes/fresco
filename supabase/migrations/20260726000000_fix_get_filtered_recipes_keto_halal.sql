-- CORRECTIVE: a transcription error during initial migration application
-- (not present in 20260725120100_create_fresco_core_tables.sql's source)
-- dropped the dieta_halal clause and mis-keyed dieta_keto against the
-- 'halal' jsonb field on the live database. Re-issuing the full, correct
-- function body via create or replace — idempotent, safe to reapply.

create or replace function public.get_filtered_recipes(p_user_id uuid)
returns setof public.recipes as $$
declare
  v_profile public.user_profiles;
begin
  select * into v_profile from public.user_profiles where id = p_user_id;

  return query
  select r.*
  from public.recipes r
  where
    not (coalesce(r.alergenos, '[]'::jsonb) ?| v_profile.alergenos)
    and (not v_profile.dieta_vegetariano or coalesce((r.dieta->>'vegetariano')::boolean, false))
    and (not v_profile.dieta_vegano      or coalesce((r.dieta->>'vegano')::boolean, false))
    and (not v_profile.dieta_sin_gluten  or coalesce((r.dieta->>'sin_gluten')::boolean, false))
    and (not v_profile.dieta_sin_lactosa or coalesce((r.dieta->>'sin_lactosa')::boolean, false))
    and (not v_profile.dieta_sin_huevo   or coalesce((r.dieta->>'sin_huevo')::boolean, false))
    and (not v_profile.dieta_keto        or coalesce((r.dieta->>'keto')::boolean, false))
    and (not v_profile.dieta_halal       or coalesce((r.dieta->>'halal')::boolean, false))
    and not (coalesce(r.ingredientes_principales, '[]'::jsonb) ?| v_profile.ingredientes_odiados);
end;
$$ language plpgsql stable security definer set search_path = public;
