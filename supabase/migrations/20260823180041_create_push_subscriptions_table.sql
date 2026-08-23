-- FRESCO-241 PR1: schema-only groundwork for the web push re-engagement
-- loop. Service worker registration, the opt-in UI, and the send/cron logic
-- are PR2/PR3 -- this migration only creates the table that will store each
-- browser's Push API subscription.
--
-- Shape mirrors `favorites` (20260804020000): simple user-owned relational
-- table, RLS policies scoped to `auth.uid()`, no SECURITY DEFINER function
-- needed because the client (browser) subscribes/unsubscribes directly via
-- supabase-js once PR2 ships the opt-in UI -- there is no shared counter or
-- cross-user contention like `rate_limits` (20260823180000 on
-- feat/FRESCO-243, unmerged) that would require an atomic RPC.
--
-- `user_id` references `public.user_profiles(id)` rather than
-- `auth.users(id)` directly, matching every other user-owned table in this
-- schema (`favorites`, `recetas_propias`, `meal_plans`, ...).
-- `user_profiles.id` is itself `references auth.users(id) on delete cascade`
-- (20260725120100), so deleting an `auth.users` row still cascades all the
-- way down to this table.
--
-- `endpoint` is globally unique per the Push API contract: it is the
-- browser-issued push service URL for one specific subscription (one
-- browser install on one device), so two rows can never share it, even
-- across different users. `p256dh`/`auth` are the subscription's own public
-- key and auth secret (`PushSubscriptionKeys`), unrelated to Supabase auth
-- -- required by the `web-push` library in PR3 to encrypt payloads.

create table public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz not null default now(),

  user_id       uuid not null references public.user_profiles(id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null
);

comment on table public.push_subscriptions is
  'Browser Push API subscriptions for the web push re-engagement loop (FRESCO-241). One row per (user, browser install). Insert on opt-in, delete on opt-out or when the push service reports the endpoint as gone (PR2/PR3).';

create index idx_push_subscriptions_user_id on public.push_subscriptions(user_id);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────────────
-- Same policy set as `favorites`: a user can only see/create/remove their
-- own subscriptions. No update policy -- a subscription is replaced
-- (delete + insert) rather than edited, same reasoning as `favorites`. No
-- anon/public access at all: push subscriptions are only ever managed by an
-- authenticated user for their own browser.

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own" on public.push_subscriptions for select
  to authenticated using ((select auth.uid()) = user_id);

create policy "push_subscriptions_insert_own" on public.push_subscriptions for insert
  to authenticated with check ((select auth.uid()) = user_id);

create policy "push_subscriptions_delete_own" on public.push_subscriptions for delete
  to authenticated using ((select auth.uid()) = user_id);

-- Table-level GRANT is still required in addition to the RLS policies above
-- (RLS restricts rows, it does not substitute for the base privilege) --
-- same gap `20260729120000_grant_authenticated_table_privileges.sql` and
-- `20260803010000_grant_authenticated_recetas_propias.sql` fixed for other
-- user-owned tables.
grant select, insert, delete on public.push_subscriptions to authenticated;
