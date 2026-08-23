# Comments for FRESCO-238

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-238)

---

### Basi Montes - 8/23/2026, 5:17:12 PM

## Spec Implementation Plan (Dev)

***Goal***: pg*cron job that deletes abandoned anonymous (`is*anonymous=true`) `auth.users` rows older than 7 days, closing the operational gap ADR-0003 names (no automatic cleanup for guests who never convert).

### Technical Decisions

- ***Mechanism***: direct SQL `DELETE FROM auth.users WHERE is*anonymous = true AND created*at < now() - interval '7 days'`, scheduled via `cron.schedule()`. No Edge Function / Admin API call needed — `delete-account`'s own comment confirms every user-owned table (`user*profiles`, `meal*plans`, `recetas_propias`, etc.) is FK'd `ON DELETE CASCADE` to `auth.users(id)`, so deleting the row is sufficient cleanup, same posture as `delete-account` and `reassign-guest-data`.
- ***Retention threshold***: 7 days (explicit product decision, not a silent default — ADR-0003 flagged this must not be silent).
- ***Linked-identity check***: `is*anonymous = true` alone is the correct filter — `updateUser({ email, password })` (ADR-0003's upgrade path) flips `is*anonymous` to `false` on conversion, so an upgraded guest is never a delete candidate.
- ***Schedule***: daily, low-traffic hour (03:00 UTC) to avoid overlap with peak usage.
- ***Extension***: `pg*cron` is available on this Supabase project (verified via `list*extensions`) but not yet installed — migration installs it in the `extensions` schema per this repo's existing extension convention (`pg_trgm`, `pgcrypto`, `uuid-ossp`).

### Steps

1. New migration `supabase/migrations/<ts>*enable*pg*cron*cleanup*abandoned*guest_users.sql`:
2. Apply migration to remote (staging/shared DB — single Supabase project for local/staging per `.agents/project.yaml`).
3. Verify: `cron.job` table has the job registered; manual dry-run of the DELETE predicate via `execute_sql` (SELECT count, not DELETE) against current anonymous users to sanity-check the WHERE clause before trusting the schedule.

### Out of scope

- No Edge Function, no admin-facing UI (differs from FRESCO-237's admin delete flow — this is a background job, not user-triggered).
- No changes to `delete-account` / `reassign-guest-data` (already handle their own cleanup paths correctly).

## Review Workload Forecast

Estimated: 1 file, ~15 lines added = 15 total lines
400-line budget risk: Low
Chain strategy: n/a (single small migration)
Decision needed before apply: No

---


_Synced from Jira by sync-jira-issues_
