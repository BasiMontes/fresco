-- FRESCO-1085 (audit 8 A8-ABUSE-01): FRESCO-1006 put the captcha and the limit in
-- POST /api/auth/guest-email, but a guest holds a normal Supabase session and can call
-- PUT /auth/v1/user {email} on Auth directly: no captcha, no limit of ours, and one mail per call
-- to any address, from the shared Auth quota.
--
-- The route cannot close that path, the database can: Auth writes the pending address to
-- auth.users.email_change (and stamps email_change_sent_at) before it mails anything, so a
-- BEFORE UPDATE trigger that refuses the write for an anonymous user without a grant stops the
-- mail at the source. The grant is a one-shot, 60-second row that only service_role can create,
-- and the route creates it after the captcha, the per-guest limit and the per-IP limit passed.
--
-- The trigger fires only when an anonymous user's pending email or its send stamp changes to a
-- non-empty value. Sign-in, token refresh, password change, the confirmation that clears
-- email_change and every registered user are untouched.

create table if not exists public.guest_email_change_grants (
  user_id uuid primary key references auth.users (id) on delete cascade,
  expires_at timestamptz not null
);

alter table public.guest_email_change_grants enable row level security;
revoke all on public.guest_email_change_grants from public, anon, authenticated;

-- Called by the route with the service-role key, never by a client.
create or replace function public.grant_guest_email_change(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from auth.users where id = p_user_id and is_anonymous) then
    raise exception 'grant_guest_email_change: not a guest' using errcode = 'P0002';
  end if;

  insert into public.guest_email_change_grants (user_id, expires_at)
  values (p_user_id, now() + interval '60 seconds')
  on conflict (user_id) do update set expires_at = excluded.expires_at;
end;
$$;

revoke execute on function public.grant_guest_email_change(uuid) from public, anon, authenticated;
grant execute on function public.grant_guest_email_change(uuid) to service_role;

create or replace function public.enforce_guest_email_change_grant()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_consumed uuid;
begin
  delete from public.guest_email_change_grants
  where user_id = new.id and expires_at > now()
  returning user_id into v_consumed;

  if v_consumed is null then
    raise exception 'guest_email_change_not_authorized: use POST /api/auth/guest-email'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_guest_email_change_grant() from public, anon, authenticated;

drop trigger if exists guest_email_change_requires_grant on auth.users;
create trigger guest_email_change_requires_grant
  before update on auth.users
  for each row
  when (
    new.is_anonymous
    and coalesce(new.email_change, '') <> ''
    and (
      new.email_change is distinct from old.email_change
      or new.email_change_sent_at is distinct from old.email_change_sent_at
    )
  )
  execute function public.enforce_guest_email_change_grant();

-- The per-IP ceiling the route applies on top of the 3/h per guest (a disposable guest rotates
-- user.id, an IP does not). check_ip_rate_limit takes its limit as a parameter, so nothing to register.
