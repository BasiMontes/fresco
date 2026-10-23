-- FRESCO-1021: one withdrawal_waiver row per purchase, not one per (user, kind, version).
--
-- The checkout (FRESCO-1003) requires a recorded `withdrawal_waiver` for the current text version.
-- The registry kept ONE row per (user, kind, version) and ignored repeats, so that row was the one
-- of the FIRST payment: a user who subscribes again months later passed the check with an old
-- acceptance. The right of withdrawal belongs to each contract (TRLGDCU arts. 102 ff.), so each new
-- subscription needs its own acceptance. This is the AI-assisted analysis' answer 5 (ADR-0066:
-- medium confidence, not a lawyer's opinion), applied by the founder's decision of 2026-10-23.
--
-- What changes:
--   1. the table-wide UNIQUE (user_id, kind, version) becomes a partial unique index that leaves
--      `withdrawal_waiver` out. The other four kinds (age_14, terms, privacy, health_data) stay
--      "once per text version", exactly as before.
--   2. record_consents records a withdrawal_waiver unless this user already has one at this
--      version inside `p_waiver_window` (default 30 minutes, the life of a Checkout session). So a
--      retry or a second click does not stack rows, and a new purchase later gets its own row.
--      `p_waiver_window` exists so the database test can say "outside the window" without
--      rewinding `accepted_at`, which nobody may write. Only the server calls this function.
--   3. a partial index serves the "latest waiver of this user" lookup the checkout now does.
--
-- Append-only is unchanged: there is still no UPDATE and no DELETE for any client role.
--
-- references/rpc-authorization.md §4, the six questions:
--   1. DEFINER needed? Yes, unchanged: service_role has no write grant on user_consents (FRESCO-794
--      gave it SELECT only), so the single writer must run with the owner's rights (ADR-0040).
--   2. Identity parameter removable? No, unchanged: the caller is service_role, which has no
--      auth.uid(); the route takes the user id from the verified session.
--   3. Actor bind: step 0, unchanged (`auth.uid() is not null and auth.uid() <> p_user_id` raises
--      P0002), and EXECUTE stays with service_role alone.
--   4. Returned rows crossing a tenant boundary: none, the function returns void. Its new reads
--      are all `where user_id = p_user_id`.
--   5. Failure path: unchanged errors, and nothing it raises discloses another user's data.
--   6. Proof against the real database: tests/db/user-consents.test.ts (window dedupe, a new row
--      outside the window, the other kinds still once per version, the 100-row cap, the spoof and
--      EXECUTE tests that already exist).
--
-- A check-then-insert race between two simultaneous calls can leave two waiver rows inside one
-- window. That only adds evidence, so it is accepted instead of locking.
--
-- The 100-row cap counts waiver rows too: one per 30-minute window at most, so a real user stays
-- far below it and a runaway writer only blocks itself.

alter table public.user_consents
  drop constraint user_consents_user_kind_version_key;

create unique index user_consents_once_per_version
  on public.user_consents (user_id, kind, version)
  where kind <> 'withdrawal_waiver';

create index user_consents_waiver_by_time
  on public.user_consents (user_id, accepted_at desc)
  where kind = 'withdrawal_waiver';

-- The signature gains a parameter, so the old three-argument function must go: leaving it would
-- keep a second, callable overload that still ignores repeats of the waiver.
drop function public.record_consents(uuid, text[], text);

create function public.record_consents(
  p_user_id uuid,
  p_kinds text[],
  p_version text,
  p_waiver_window interval default interval '30 minutes'
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_kind text;
  v_new int;
  v_waiver_wanted boolean;
  v_waiver_recent boolean := false;
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

  if p_waiver_window is null or p_waiver_window < interval '0' or p_waiver_window > interval '1 day' then
    raise exception 'record_consents: the waiver window must be between 0 and 1 day'
      using errcode = '22023';
  end if;

  foreach v_kind in array p_kinds loop
    if v_kind is null or v_kind not in ('age_14', 'terms', 'privacy', 'health_data', 'withdrawal_waiver') then
      raise exception 'record_consents: unknown kind %', v_kind
        using errcode = '22023';
    end if;
  end loop;

  v_waiver_wanted := 'withdrawal_waiver' = any(p_kinds);

  if v_waiver_wanted then
    select exists (
      select 1
      from public.user_consents c
      where c.user_id = p_user_id
        and c.kind = 'withdrawal_waiver'
        and c.version = p_version
        and c.accepted_at > now() - p_waiver_window
    ) into v_waiver_recent;
  end if;

  -- Rows this call would add: the once-per-version kinds not recorded yet, plus the waiver when
  -- there is none inside the window.
  select count(*) into v_new
  from (select distinct unnest(p_kinds) as kind) as wanted
  where wanted.kind <> 'withdrawal_waiver'
    and not exists (
      select 1
      from public.user_consents c
      where c.user_id = p_user_id and c.kind = wanted.kind and c.version = p_version
    );

  if v_waiver_wanted and not v_waiver_recent then
    v_new := v_new + 1;
  end if;

  if (select count(*) from public.user_consents where user_id = p_user_id) + v_new > 100 then
    raise exception 'record_consents: user % reached the limit of 100 consent rows', p_user_id
      using errcode = 'P0001';
  end if;

  insert into public.user_consents (user_id, kind, version)
  select p_user_id, wanted.kind, p_version
  from (select distinct unnest(p_kinds) as kind) as wanted
  where wanted.kind <> 'withdrawal_waiver'
  on conflict (user_id, kind, version) where kind <> 'withdrawal_waiver' do nothing;

  if v_waiver_wanted and not v_waiver_recent then
    insert into public.user_consents (user_id, kind, version)
    values (p_user_id, 'withdrawal_waiver', p_version);
  end if;
end;
$$;

comment on function public.record_consents(uuid, text[], text, interval) is
  'The only writer of user_consents (FRESCO-1007). EXECUTE: service_role only. The user id comes from the verified session and the version from LEGAL_TEXTS_VERSION, both set by POST /api/consents. The four non-waiver kinds are recorded once per text version; a withdrawal_waiver is recorded once per p_waiver_window (default 30 minutes), so each purchase has its own row (FRESCO-1021).';

revoke execute on function public.record_consents(uuid, text[], text, interval) from public, anon, authenticated;
grant execute on function public.record_consents(uuid, text[], text, interval) to service_role;
