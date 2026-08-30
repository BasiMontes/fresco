-- ─────────────────────────────────────────────────────────────────────────────
-- FRESCO-310 — Move the rate-limit exemption list out of the function body.
--
-- Supersedes 20260827215620_rate_limit_exempt_test_users.sql (append-only — that
-- migration is not edited). That migration hardcoded 4 production test-account
-- UUIDs into the body of `check_and_increment_rate_limit`, a SECURITY DEFINER
-- function. FRESCO-310 isolates the CI e2e suite onto an ephemeral local Supabase
-- stack whose seeded test users have DIFFERENT UUIDs — so the exemption list has
-- to be data, not code.
--
-- WHAT CHANGES
--   * New table `public.rate_limit_exempt_users` (user_id → auth.users, note).
--     RLS enabled, zero policies — same locked-down shape as `public.rate_limits`
--     (20260827210808): no client role ever touches it, all reads happen inside
--     the SECURITY DEFINER function.
--   * `check_and_increment_rate_limit` keeps the exact same body EXCEPT the
--     `v_test_users uuid[]` array and the `p_user_id = any(v_test_users)` check
--     are replaced by an `exists (select 1 from public.rate_limit_exempt_users
--     …)` lookup.
--   * The 4 existing production UUIDs are inserted as data (`on conflict do
--     nothing`) so prod `@smoke` (post-deploy-smoke.yml, real prod backend)
--     keeps working unchanged after this migration is `db push`ed to prod.
--   * The local CI seed (supabase/seed.sql) inserts the local test-user UUIDs
--     into this same table.
--
-- Grants/revokes from 20260827210808 are re-issued explicitly (defensive —
-- `create or replace function` already preserves them).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.rate_limit_exempt_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note    text
);

alter table public.rate_limit_exempt_users enable row level security;

revoke all on public.rate_limit_exempt_users from public, anon, authenticated;

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
begin
  if p_window_seconds <> 3600 then
    raise exception 'check_and_increment_rate_limit: only 3600s windows supported in v1, got %', p_window_seconds;
  end if;

  if p_user_id <> auth.uid() then
    raise exception 'check_and_increment_rate_limit: caller does not own user_id %', p_user_id;
  end if;

  -- e2e / smoke test accounts — exempt from rate limiting. The membership
  -- list is data (public.rate_limit_exempt_users), not a hardcoded array, so
  -- an ephemeral CI stack can register its own seeded UUIDs (FRESCO-310).
  -- Real users are unaffected: this is an explicit membership test against a
  -- table only reachable from inside this SECURITY DEFINER function.
  if exists (
    select 1 from public.rate_limit_exempt_users e where e.user_id = p_user_id
  ) then
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

revoke execute on function public.check_and_increment_rate_limit(uuid, text, int, int) from public, anon;
grant execute on function public.check_and_increment_rate_limit(uuid, text, int, int) to authenticated;

-- Production test accounts — carried over from 20260827215620 so prod @smoke
-- keeps its exemption after this migration is pushed to prod. `on conflict do
-- nothing` keeps this replayable and a no-op on a database that lacks these
-- auth.users rows (e.g. a fresh local/CI stack — the FK would otherwise fail,
-- so the insert is guarded to only touch UUIDs that actually exist).
insert into public.rate_limit_exempt_users (user_id, note)
select v.user_id, v.note
from (values
  ('9db00aac-ccaf-4890-a776-41ec5754dc94'::uuid, 'prod test account: hola.frescoapp+dev-user@gmail.com'),
  ('8dc4c490-ea98-4c7b-b610-c315d77febfb'::uuid, 'prod test account: hola.frescoapp+pre-user@gmail.com'),
  ('d757a8bb-0f19-4aca-9c90-cbba656b2a4c'::uuid, 'prod test account: hola.frescoapp+pro-user@gmail.com'),
  ('5b900e16-041f-4906-af43-38adfe992bf3'::uuid, 'prod test account: throwaway')
) as v(user_id, note)
where exists (select 1 from auth.users u where u.id = v.user_id)
on conflict (user_id) do nothing;
