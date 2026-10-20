-- FRESCO-1017 (definitive audit 7b, A7-OPS-02): a heartbeat for the pg_cron jobs that had none.
--
-- `stripe-reconcile` already writes `job_heartbeat` (FRESCO-915). The two jobs below run inside the
-- database, so they write their own row as the last statement of the command. pg_cron runs a
-- multi-statement command as one implicit transaction: if the first statement raises, the
-- heartbeat is never written, so a row means "the whole pass completed".
--
-- The other two jobs (`retry-posthog-erasures`, `send-weekly-reengagement-push`) are Edge
-- Functions and write their own heartbeat from `_shared/job-heartbeat.ts`.
--
-- `cron.schedule` upserts by job name, so the schedule is unchanged and only the command grows.
-- The cron role owns `job_heartbeat` (it created the table), so no grant is needed.

-- 03:00 UTC daily. Same call as 20261019170000, plus the heartbeat.
select cron.schedule(
  'cleanup-abandoned-guest-users',
  '0 3 * * *',
  $$
    select public.cleanup_abandoned_guests();
    insert into public.job_heartbeat (job, last_success_at, updated_at)
    values ('cleanup-abandoned-guest-users', now(), now())
    on conflict (job) do update set last_success_at = excluded.last_success_at, updated_at = excluded.updated_at;
  $$
);

-- 03:30 UTC daily. Same retention as 20261019180000, plus the heartbeat.
select cron.schedule(
  'purge-waitlist-signups',
  '30 3 * * *',
  $$
    delete from public.waitlist_signups
     where (confirmed_at is null and created_at < now() - interval '7 days')
        or (confirmed_at is not null and confirmed_at < now() - interval '12 months');
    delete from public.ip_rate_limits where window_start < date_trunc('hour', now()) - interval '2 hours';
    insert into public.job_heartbeat (job, last_success_at, updated_at)
    values ('purge-waitlist-signups', now(), now())
    on conflict (job) do update set last_success_at = excluded.last_success_at, updated_at = excluded.updated_at;
  $$
);
