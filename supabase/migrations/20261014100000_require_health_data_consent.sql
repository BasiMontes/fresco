-- FRESCO-917 (audit C-13, GDPR art. 9): allergies and diet restrictions are health
-- data, and the consent for them (`user_consents.kind = 'health_data'`, ADR-0040)
-- was only asked in the UI. Nothing on the server checked it: a client with its
-- own session could write `alergenos` or `dieta_*` straight to `user_profiles`
-- with no consent row at all (2 of 4 profiles in production were in that state).
--
-- Fix: a BEFORE INSERT OR UPDATE trigger on `public.user_profiles` that refuses a
-- client write which leaves health data in the row when the owner has no
-- `health_data` consent.
--
-- What it checks, and what it does not:
--   * "Health data" = the same set the wizard counts (`collectsHealthData`):
--     `alergenos`, any `dieta_*` flag, `dieta_texto_libre`, plus the legacy
--     `alergenos_texto_libre`.
--   * The consent is ANY `health_data` row of the owner, whatever its version.
--     The current text version lives in code (`LEGAL_TEXTS_VERSION`), not in the
--     database, and ADR-0040 rejected a second source of truth for it. So this
--     proves "the user consented once", not "to today's text".
--   * An UPDATE is checked only when a health column CHANGES. A legacy profile
--     with no consent can still change its name or plan; it is asked for consent
--     the moment it edits allergies or diet. Clearing health data is always
--     allowed (data minimisation must never be blocked).
--   * `service_role` and the direct superuser connections (seed, admin tooling)
--     are exempt, the same allowlist as `protect_subscription_columns`
--     (FRESCO-360): `session_user` is the login role and survives `SET ROLE`.
--
-- SECURITY INVOKER on purpose, no identity parameter: it reads
-- `user_consents` under the caller's own RLS (owner-only SELECT), and the row it
-- checks is `new.id`, which `profiles_insert_own` / `profiles_update_own` already
-- pin to `auth.uid()`. Nothing to spoof (ADR-0032, references/rpc-authorization.md).
--
-- Note for upserts: a BEFORE INSERT trigger fires before ON CONFLICT is resolved,
-- so `upsertUserProfile` for a user with health data and no consent is refused
-- even when the health columns are unchanged. That is the intended outcome: the
-- wizard and the preferences form ask for the consent first.

create or replace function public.require_health_data_consent()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_has_health_data boolean;
begin
  if auth.role() = 'service_role'
    or session_user in ('postgres', 'supabase_admin', 'supabase_auth_admin')
  then
    return new;
  end if;

  v_has_health_data :=
    cardinality(new.alergenos) > 0
    or new.dieta_vegetariano
    or new.dieta_vegano
    or new.dieta_sin_gluten
    or new.dieta_sin_lactosa
    or new.dieta_sin_huevo
    or new.dieta_keto
    or new.dieta_halal
    or btrim(coalesce(new.dieta_texto_libre, '')) <> ''
    or btrim(coalesce(new.alergenos_texto_libre, '')) <> '';

  if not v_has_health_data then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and new.alergenos is not distinct from old.alergenos
    and new.dieta_vegetariano is not distinct from old.dieta_vegetariano
    and new.dieta_vegano is not distinct from old.dieta_vegano
    and new.dieta_sin_gluten is not distinct from old.dieta_sin_gluten
    and new.dieta_sin_lactosa is not distinct from old.dieta_sin_lactosa
    and new.dieta_sin_huevo is not distinct from old.dieta_sin_huevo
    and new.dieta_keto is not distinct from old.dieta_keto
    and new.dieta_halal is not distinct from old.dieta_halal
    and new.dieta_texto_libre is not distinct from old.dieta_texto_libre
    and new.alergenos_texto_libre is not distinct from old.alergenos_texto_libre
  then
    return new;
  end if;

  if exists (
    select 1
    from public.user_consents c
    where c.user_id = new.id
      and c.kind = 'health_data'
  ) then
    return new;
  end if;

  raise exception 'health_data consent required before saving allergies or diet (GDPR art. 9)'
    using errcode = 'P0001',
          hint = 'Record a health_data consent (POST /api/consents) first.';
end;
$$;

comment on function public.require_health_data_consent() is
  'FRESCO-917: refuses a client write that leaves allergies or diet in user_profiles without a health_data consent (GDPR art. 9).';

revoke all on function public.require_health_data_consent() from public, anon, authenticated;

create trigger require_health_data_consent
  before insert or update on public.user_profiles
  for each row
  execute function public.require_health_data_consent();
