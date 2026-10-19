-- FRESCO-1007 (audit 7b: A7-API-02, A7-ABUSE-03): the consent registry could be written by the
-- client, and that broke what a registry is for.
--
-- user_consents carried an INSERT grant on (kind, version) for `authenticated`. The route stamps the
-- version from a server constant (LEGAL_TEXTS_VERSION), but a client that skips the route could
-- insert any version it liked, so the registry could be made to say a user accepted a text version
-- that never existed, or one they were never shown. It could also insert rows without limit.
--
-- Now nobody but the server writes it:
--   1. the INSERT grant and its policy are gone (SELECT stays: a user reads their own rows, and the
--      authenticated layout asks "has this user accepted the CURRENT texts?");
--   2. record_consents(p_user_id, p_kinds, p_version) is the only writer. SECURITY DEFINER, because
--      service_role has no write grant on this table either (FRESCO-794 gave it SELECT only), and
--      EXECUTE goes to service_role alone: POST /api/consents authenticates the caller from the
--      session, takes the user id from it and the version from LEGAL_TEXTS_VERSION, then calls this.
--      No client role can reach it, so the user id and the version are never caller input.
--   3. a user holds at most 100 rows. The kinds are five and a row is added per kind per text
--      version, so a real user stays far below it; the cap only stops a runaway writer.
--
-- The function checks the actor even though only the server may call it (references/rpc-authorization.md):
-- the check passes for the service role (auth.uid() is null) and refuses if EXECUTE is ever granted to a
-- client role by mistake.
--
-- Recording the same (user, kind, version) again is a no-op, as before, so a retry or a second tab
-- stays harmless.

revoke insert on table public.user_consents from authenticated;
drop policy if exists user_consents_insert_own on public.user_consents;

create or replace function public.record_consents(
  p_user_id uuid,
  p_kinds text[],
  p_version text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_kind text;
  v_new int;
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'record_consents: caller does not own user_id %', p_user_id
      using errcode = 'P0002';
  end if;

  if p_version is null or length(p_version) not between 1 and 60 then
    raise exception 'record_consents: the version must be 1 to 60 characters'
      using errcode = '22023';
  end if;

  if p_kinds is null or cardinality(p_kinds) not between 1 and 5 then
    raise exception 'record_consents: between 1 and 5 kinds are required'
      using errcode = '22023';
  end if;

  foreach v_kind in array p_kinds loop
    if v_kind is null or v_kind not in ('age_14', 'terms', 'privacy', 'health_data', 'withdrawal_waiver') then
      raise exception 'record_consents: unknown kind %', v_kind
        using errcode = '22023';
    end if;
  end loop;

  select count(*) into v_new
  from (select distinct unnest(p_kinds) as kind) as wanted
  where not exists (
    select 1
    from public.user_consents c
    where c.user_id = p_user_id and c.kind = wanted.kind and c.version = p_version
  );

  if (select count(*) from public.user_consents where user_id = p_user_id) + v_new > 100 then
    raise exception 'record_consents: user % reached the limit of 100 consent rows', p_user_id
      using errcode = 'P0001';
  end if;

  insert into public.user_consents (user_id, kind, version)
  select p_user_id, wanted.kind, p_version
  from (select distinct unnest(p_kinds) as kind) as wanted
  on conflict (user_id, kind, version) do nothing;
end;
$$;

comment on function public.record_consents(uuid, text[], text) is
  'The only writer of user_consents (FRESCO-1007). EXECUTE: service_role only. The user id comes from the verified session and the version from LEGAL_TEXTS_VERSION, both set by POST /api/consents; at most 100 rows per user.';

revoke execute on function public.record_consents(uuid, text[], text) from public, anon, authenticated;
grant execute on function public.record_consents(uuid, text[], text) to service_role;
