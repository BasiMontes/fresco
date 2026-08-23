-- FRESCO-238 follow-up: retention shortened from 7 to 3 days, paired with a
-- UI warning added to the guest-mode entry screen (identity-step.tsx) so the
-- shorter window is communicated up front, not silently applied.
--
-- `cron.schedule()` upserts by job name — re-scheduling the same
-- 'cleanup-abandoned-guest-users' job updates its command in place rather
-- than creating a duplicate.

select cron.schedule(
  'cleanup-abandoned-guest-users',
  '0 3 * * *',
  $$ delete from auth.users where is_anonymous = true and created_at < now() - interval '3 days' $$
);
