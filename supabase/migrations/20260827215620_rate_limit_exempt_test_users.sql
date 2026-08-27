-- FRESCO-243 follow-up: the e2e suite (test:e2e, a blocking CI check) makes
-- ~12 `generate-meal-plan` calls per run, several for the same shared test
-- account within the hour — which the newly-live 5/hour limit would 429,
-- turning every PR red.
--
-- Carve the known test-account UIDs out of the limit. This is deliberately
-- a hardcoded UID list, not a config table — a config table + admin UI is
-- the right long-term shape but is disproportionate for 4 fixed rows on a
-- single-maintainer project. The UIDs are the `hola.frescoapp+{dev,pre,pro}
-- -user@gmail.com` accounts + the throwaway, all created 2026-08-27
-- (see the [[project-supabase-test-users-per-env]] register).
--
-- Real users are unaffected: the exemption is an explicit membership test,
-- and a real account can never hold one of these fixed UUIDs.

create or replace function public.check_and_increment_rate_limit(
  p_user_id        uuid,
  p_endpoint       text,
  p_limit          int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz := date_trunc('hour', now());
  v_count        int;
  -- e2e test accounts — exempt from rate limiting (see migration header).
  v_test_users uuid[] := array[
    '9db00aac-ccaf-4890-a776-41ec5754dc94',  -- +dev-user
    '8dc4c490-ea98-4c7b-b610-c315d77febfb',  -- +pre-user
    'd757a8bb-0f19-4aca-9c90-cbba656b2a4c',  -- +pro-user
    '5b900e16-041f-4906-af43-38adfe992bf3'   -- throwaway
  ]::uuid[];
begin
  if p_window_seconds <> 3600 then
    raise exception 'check_and_increment_rate_limit: only 3600s windows supported in v1, got %', p_window_seconds;
  end if;

  if p_user_id <> auth.uid() then
    raise exception 'check_and_increment_rate_limit: caller does not own user_id %', p_user_id;
  end if;

  if p_user_id = any(v_test_users) then
    return true;
  end if;

  insert into public.rate_limits (user_id, endpoint, window_start, count)
  values (p_user_id, p_endpoint, v_window_start, 1)
  on conflict (user_id, endpoint, window_start)
  do update set
    count      = public.rate_limits.count + 1,
    updated_at = now()
  where public.rate_limits.count < p_limit
  returning count into v_count;

  if v_count is null then
    return false;
  end if;

  return true;
end;
$$;
