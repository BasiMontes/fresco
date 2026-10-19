-- FRESCO-1008 (audit 7b A7-PRIV-03, A7-API-01): the waitlist grows three guards.
--
--  1. Writes only through server functions. The browser roles lose their INSERT grant and
--     policy: the API route calls `request_waitlist_signup` with the service role, and the
--     consent version is the server's, set by that call (same shape as `record_consents`,
--     FRESCO-1007).
--  2. Double opt-in. A row is created unconfirmed with the hash of a random token; the token
--     goes to the address in an email, and only the person who holds the mailbox can confirm
--     it. Nobody is mailed unless `confirmed_at` is set. Confirmation and removal both take
--     the token, so every email carries its own way out (GDPR art. 7.3).
--  3. A limit on the route, per client address. There was none. `ip_rate_limits` keeps only a
--     salted-by-endpoint hash of the address, never the address.
--
-- Retention (declared in the privacy policy): an unconfirmed signup is deleted after 7 days,
-- a confirmed one after 12 months, and a token removes it at any time. Signups that already
-- exist were never confirmed, so they are unconfirmed rows and follow the 7-day rule: nobody
-- has been mailed from this list yet.

alter table public.waitlist_signups
  add column confirm_token_hash  text check (confirm_token_hash ~ '^[0-9a-f]{64}$'),
  add column confirmed_at        timestamptz,
  add column confirmation_sent_at timestamptz;

create unique index waitlist_signups_token_key on public.waitlist_signups (confirm_token_hash)
  where confirm_token_hash is not null;

comment on column public.waitlist_signups.confirmed_at is
  'When the owner of the mailbox confirmed (double opt-in). The launch mailing selects confirmed_at is not null, never anything else.';

-- 1. Writes only through the functions below.
drop policy if exists waitlist_signups_insert on public.waitlist_signups;
revoke insert on table public.waitlist_signups from anon, authenticated;
revoke insert (email, consent_version) on table public.waitlist_signups from anon, authenticated;

-- 3. The per-address limit. Fixed hourly window, same idea as `rate_limits`.
create table public.ip_rate_limits (
  key_hash     text        not null check (key_hash ~ '^[0-9a-f]{64}$'),
  endpoint     text        not null,
  window_start timestamptz not null,
  count        int         not null default 1,
  primary key (key_hash, endpoint, window_start)
);

alter table public.ip_rate_limits enable row level security;
revoke all on public.ip_rate_limits from public, anon, authenticated;

create or replace function public.check_ip_rate_limit(p_key_hash text, p_endpoint text, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  if p_limit < 1 then
    raise exception 'check_ip_rate_limit: limit must be positive' using errcode = '22023';
  end if;

  insert into public.ip_rate_limits (key_hash, endpoint, window_start, count)
  values (p_key_hash, p_endpoint, date_trunc('hour', now()), 1)
  on conflict (key_hash, endpoint, window_start)
  do update set count = public.ip_rate_limits.count + 1
  where public.ip_rate_limits.count < p_limit
  returning count into v_count;

  return v_count is not null;
end;
$$;

revoke execute on function public.check_ip_rate_limit(text, text, int) from public, anon, authenticated;
grant execute on function public.check_ip_rate_limit(text, text, int) to service_role;

-- 2. Sign up. Returns what the route has to do: 'send' (a new row, or an unconfirmed one whose
-- last email is older than 10 minutes: mail the new token), 'throttled' (an unconfirmed one
-- mailed a moment ago) or 'confirmed' (already on the list). The route answers the same to all
-- three, so the form cannot be used to learn who is on the list, and 'throttled' keeps one
-- address from being flooded with confirmation emails by whoever types it.
create or replace function public.request_waitlist_signup(p_email text, p_version text, p_token_hash text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.waitlist_signups;
begin
  if p_version is null or length(p_version) not between 1 and 60 then
    raise exception 'request_waitlist_signup: invalid version' using errcode = '22023';
  end if;

  select * into v_row from public.waitlist_signups where lower(email) = lower(p_email) for update;

  if not found then
    insert into public.waitlist_signups (email, consent_version, confirm_token_hash, confirmation_sent_at)
    values (p_email, p_version, p_token_hash, now())
    on conflict (lower(email)) do nothing;
    -- A concurrent insert of the same address won the race: nothing to send from this call.
    return case when found then 'send' else 'throttled' end;
  end if;

  if v_row.confirmed_at is not null then
    return 'confirmed';
  end if;

  if v_row.confirmation_sent_at > now() - interval '10 minutes' then
    return 'throttled';
  end if;

  update public.waitlist_signups
     set confirm_token_hash = p_token_hash, confirmation_sent_at = now(), consent_version = p_version
   where id = v_row.id;
  return 'send';
end;
$$;

revoke execute on function public.request_waitlist_signup(text, text, text) from public, anon, authenticated;
grant execute on function public.request_waitlist_signup(text, text, text) to service_role;

create or replace function public.confirm_waitlist_signup(p_token_hash text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  with updated as (
    update public.waitlist_signups
       set confirmed_at = coalesce(confirmed_at, now())
     where confirm_token_hash = p_token_hash
    returning 1
  )
  select exists (select 1 from updated);
$$;

create or replace function public.remove_waitlist_signup(p_token_hash text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  with removed as (
    delete from public.waitlist_signups
     where confirm_token_hash = p_token_hash
    returning 1
  )
  select exists (select 1 from removed);
$$;

revoke execute on function public.confirm_waitlist_signup(text) from public, anon, authenticated;
revoke execute on function public.remove_waitlist_signup(text) from public, anon, authenticated;
grant execute on function public.confirm_waitlist_signup(text) to service_role;
grant execute on function public.remove_waitlist_signup(text) to service_role;

-- Retention.
select cron.schedule(
  'purge-waitlist-signups',
  '30 3 * * *',
  $$
    delete from public.waitlist_signups
     where (confirmed_at is null and created_at < now() - interval '7 days')
        or (confirmed_at is not null and confirmed_at < now() - interval '12 months');
    delete from public.ip_rate_limits where window_start < date_trunc('hour', now()) - interval '2 hours';
  $$
);
