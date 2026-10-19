-- FRESCO-1008 (audit 7b A7-PRIV-05, GDPR art. 17): the abandoned-guest sweep deleted the
-- auth user and nothing else. A guest who accepted analytics has a PostHog person keyed by
-- the auth user id (`identifyUser(user.id, ...)`), and that person outlived the guest for
-- good: the id was gone, so nobody could ask PostHog to delete it.
--
-- The sweep moves into a function so it is one tested unit. For every guest it is about to
-- delete it first writes an `account_erasures` row in the state `retry-posthog-erasures`
-- already works from (`posthog = 'failed'` plus `pending_posthog_distinct_id`): the daily
-- retry deletes the person, reports `deleted` or `not_found`, and clears the id. The
-- `failed` value here means "queued"; the table constraint ties it to the id and there is
-- no separate queued state to add.
--
-- Retention itself stays what 20260823160000 set: 3 days from creation (the default of
-- `p_max_age`, which only the DB test lowers), not from the last activity. The privacy policy now says so (it used to say "after a period of inactivity").
--
-- `search_path` is pinned. It deletes users, so only the service role (and the cron job's
-- owner) may run it.

create or replace function public.cleanup_abandoned_guests(p_max_age interval default interval '3 days')
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_deleted integer;
begin
  with doomed as (
    select id
    from auth.users
    where is_anonymous = true
      and created_at < now() - p_max_age
  ),
  queued as (
    insert into public.account_erasures (user_hash, stripe, posthog, pending_posthog_distinct_id)
    select encode(extensions.digest(doomed.id::text, 'sha256'), 'hex'), 'none', 'failed', doomed.id::text
    from doomed
    returning 1
  ),
  removed as (
    delete from auth.users
    where id in (select id from doomed)
    returning 1
  )
  select count(*) into v_deleted from removed;

  return v_deleted;
end;
$$;

comment on function public.cleanup_abandoned_guests(interval) is
  'Deletes guests older than 3 days and queues their PostHog person for deletion in account_erasures (FRESCO-1008). Called by pg_cron.';

revoke execute on function public.cleanup_abandoned_guests(interval) from public, anon, authenticated;
grant execute on function public.cleanup_abandoned_guests(interval) to service_role;

-- Same job name, new command: `cron.schedule` upserts by name.
select cron.schedule(
  'cleanup-abandoned-guest-users',
  '0 3 * * *',
  $$ select public.cleanup_abandoned_guests() $$
);
