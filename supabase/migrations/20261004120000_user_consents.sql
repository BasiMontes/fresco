-- FRESCO-794 (audit-6 A6-P1, ADR-0040): the consent registry. One append-only row
-- per consent a user gave (age 14+, Terms, Privacy, health data, withdrawal
-- waiver), with the version of the text accepted and when. GDPR art. 7.1 makes
-- the controller demonstrate consent, and nothing recorded it until now.
--
-- Access: RLS on, owner-only. A user reads their own rows and inserts their own,
-- and nothing else: no UPDATE and no DELETE policy, so a row cannot be rewritten
-- or withdrawn from the client. The INSERT grant is column-level, `(kind,
-- version)` only, so `user_id` (default `auth.uid()`), `accepted_at` (default
-- `now()`) and `id` can never be supplied by the caller: the timestamp is the
-- database's, the owner is the session's.
--
-- Guests: an anonymous session is an `authenticated` JWT with an `auth.users`
-- row, so a guest can record consent before any `user_profiles` row exists, and
-- the rows follow the same `user_id` when the guest converts to an account.
-- That is why the foreign key points at `auth.users`, not `user_profiles`.
--
-- No function and no identity parameter: there is nothing to spoof (ADR-0032,
-- references/rpc-authorization.md). The version string is set by the API route
-- from a server constant; the table only bounds its length. A user who bypassed
-- the route could write a wrong version for their OWN consent only, which is
-- self-inflicted and recorded as such in ADR-0040.

create table public.user_consents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('age_14', 'terms', 'privacy', 'health_data', 'withdrawal_waiver')),
  version     text not null check (length(version) between 1 and 60),
  accepted_at timestamptz not null default now(),
  constraint user_consents_user_kind_version_key unique (user_id, kind, version)
);

comment on table public.user_consents is
  'Append-only registry of consents given by a user, with the version of the text accepted (ADR-0040).';

alter table public.user_consents enable row level security;

create policy user_consents_select_own on public.user_consents
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy user_consents_insert_own on public.user_consents
  for insert to authenticated
  with check (user_id = (select auth.uid()));

revoke all on table public.user_consents from public, anon, authenticated;
grant select on table public.user_consents to authenticated;
grant insert (kind, version) on table public.user_consents to authenticated;
-- service_role gets no default grant on this table (same gap FRESCO-360 closed for
-- user_profiles). Read-only: audits and a data export need to read the evidence;
-- nothing server-side writes it except through the user's own session.
grant select on table public.user_consents to service_role;
