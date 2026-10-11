-- FRESCO-888: the launch waitlist. A visitor with no account leaves an email and
-- ticks one consent; the row keeps the version of the text they accepted and
-- when (GDPR art. 7.1), same idea as `user_consents` (ADR-0040) but keyed by
-- email, because a visitor has no `auth.users` row to point at.
--
-- Access: RLS on, insert-only for the browser roles. `anon` and `authenticated`
-- can add a row and can never read, change or delete one, so the list of
-- interested people is not exposed to anybody holding the public key. The INSERT
-- grant is column-level `(email, consent_version)`: `id` and `created_at` are the
-- database's, so a caller cannot backdate a signup. `service_role` gets read-only
-- access, for counting signups and for the launch-day export.
--
-- One row per address: the unique index is on `lower(email)`, so a second signup
-- with different casing is a unique violation, which the API route treats as a
-- success (it must not reveal whether an address is already on the list).
--
-- No function and no identity parameter: nothing to spoof (ADR-0032). The
-- consent version is set by `POST /api/waitlist` from `LEGAL_TEXTS_VERSION`; the
-- table only bounds its length.

create table public.waitlist_signups (
  id              uuid primary key default gen_random_uuid(),
  email           text not null check (length(email) between 3 and 254 and email like '%_@_%._%'),
  consent_version text not null check (length(consent_version) between 1 and 60),
  created_at      timestamptz not null default now()
);

create unique index waitlist_signups_email_key on public.waitlist_signups (lower(email));

comment on table public.waitlist_signups is
  'Pre-launch waitlist: an email plus the version of the consent text accepted (FRESCO-888). Insert-only for the browser roles.';

alter table public.waitlist_signups enable row level security;

create policy waitlist_signups_insert on public.waitlist_signups
  for insert to anon, authenticated
  with check (true);

revoke all on table public.waitlist_signups from public, anon, authenticated;
grant insert (email, consent_version) on table public.waitlist_signups to anon, authenticated;
grant select on table public.waitlist_signups to service_role;
