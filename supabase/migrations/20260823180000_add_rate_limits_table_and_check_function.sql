-- FRESCO-243 / ADR-0010: Postgres-native rate limiting for abuse-prone Edge
-- Functions, no external dependency (Upstash/Redis rejected in the ADR).
--
-- Shared `rate_limits` table keyed by (user_id, endpoint, window_start), so
-- any future Edge Function adopts the same mechanism by passing its own
-- `endpoint` string — no new table, no bespoke logic per call site.
--
-- `check_and_increment_rate_limit` does the check-and-increment as a single
-- atomic statement (INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING).
-- This is the load-bearing invariant from the ADR: two concurrent requests
-- from the same user for the same window can never both observe "count is
-- still under the limit" and both proceed — Postgres takes a row-level lock
-- on the conflicting key for the duration of the upsert, so the second
-- concurrent caller sees the first caller's increment before deciding
-- whether it, too, is allowed to increment. A read-then-write two-round-trip
-- check (SELECT count, compare, UPDATE) was explicitly rejected in the ADR's
-- Alternatives section for exactly this race.
--
-- Fixed-window (not sliding): `window_start` is truncated to the top of the
-- current hour, so the window resets on the hour boundary rather than
-- continuously. `p_window_seconds` is kept in the function signature per the
-- ADR's declared RPC contract (`check_and_increment_rate_limit(p_user_id
-- uuid, p_endpoint text, p_limit int, p_window_seconds int) returns
-- boolean`) so future adopting endpoints can pass their own threshold, but
-- this v1 implementation fixes the truncation granularity to the hour
-- boundary regardless of the value passed. Rather than silently ignoring a
-- mismatched value, the function raises if `p_window_seconds <> 3600` — a
-- future caller expecting a different window fails loudly at the RPC
-- boundary instead of silently getting the wrong window. A future adopter
-- that genuinely needs a different window size is a new decision, not an
-- automatic extension of this migration (same "no automatic upgrade" stance
-- the ADR itself takes on fixed vs. sliding windows).

create table public.rate_limits (
  user_id      uuid        not null references auth.users(id) on delete cascade,
  endpoint     text        not null,
  window_start timestamptz not null,
  count        int         not null default 1,
  updated_at   timestamptz not null default now(),
  primary key (user_id, endpoint, window_start)
);

-- RLS: enabled with zero policies for `authenticated`/`anon` — no client
-- ever reads or writes this table directly. All access goes through
-- `check_and_increment_rate_limit`, a SECURITY DEFINER function that
-- bypasses RLS but self-validates `p_user_id = auth.uid()` before touching
-- any row, same convention as `get_filtered_recipes` in
-- 20260801010000_harden_security_definer_functions.sql. Table privileges
-- are revoked outright (belt-and-suspenders: even if RLS were later
-- disabled by mistake, there is still no GRANT for a client role to exploit).
alter table public.rate_limits enable row level security;

revoke all on public.rate_limits from public, anon, authenticated;

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

  -- Single atomic statement: inserts a fresh row (count = 1) for a new
  -- window, or increments the existing row's count IF it is still under
  -- the limit. When the row is already at/over p_limit, the DO UPDATE's
  -- WHERE clause suppresses the update entirely — no row is touched, no row
  -- is returned by RETURNING, and `v_count` is left NULL by `... INTO`, which
  -- is exactly how the "limit exceeded" case is detected below. No
  -- read-then-write gap exists anywhere in this statement.
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
