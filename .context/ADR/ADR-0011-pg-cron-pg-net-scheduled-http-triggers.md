# ADR-0011 — pg_cron + pg_net for scheduled HTTP-triggered jobs

- **Status:** Proposed
- **Date:** 2026-08-23
- **Deciders:** Basi Montes
- **Tags:** scheduling, edge-functions, cross-cutting-invariant, infrastructure
- **Supersedes:** —
- **Superseded by:** —

---

## Context

FRESCO-241 (PR3) needs a weekly job that finds users who haven't planned meals this week and sends them a web push reminder. The send logic (payload construction, VAPID signing, per-subscription delivery, stale-subscription cleanup) is Deno/TypeScript-shaped work that belongs in a Supabase Edge Function, not a PL/pgSQL function — but the trigger needs to be time-based (weekly, no user action fires it).

`pg_cron` is already the project's scheduler (`ADR` precedent: FRESCO-238's `cleanup-abandoned-guest-users` daily job runs pure SQL inside the database, no outbound call needed). This is the first case where a cron job needs to reach OUTSIDE the database — to invoke an Edge Function over HTTP. `pg_net` (Supabase's async HTTP extension) is available on this project (`list_extensions` confirms `pg_net` present, not yet installed) and is Supabase's documented, supported pattern for exactly this: a `pg_cron` job whose command is a `net.http_post(...)` call to an Edge Function URL, authenticated with the `service_role` key (stored via Vault or a `current_setting`, never hardcoded in the migration).

This establishes a reusable pattern: any future feature needing "run this Edge Function on a schedule" follows the same shape.

## Decision

We will schedule FRESCO-241's weekly send job via `pg_cron`, whose command body calls `net.http_post()` against the `send-weekly-push-reminders` Edge Function URL, authenticated with the service role key. `pg_net` will be enabled (`create extension pg_net`) alongside the existing `pg_cron` extension. Any future scheduled job that needs to reach an Edge Function (or any external HTTP endpoint) from the database follows this same `pg_cron` + `pg_net` shape rather than introducing a second scheduler (e.g. Vercel Cron, GitHub Actions cron) for database-adjacent scheduled work.

## Consequences

- **Positive:** one scheduler for all time-based jobs (pure-SQL and HTTP-triggered alike), consistent with the existing `pg_cron` precedent from FRESCO-238; no new infrastructure dependency; the schedule lives in a migration (version-controlled, reviewable) rather than a third-party dashboard.
- **Negative / trade-offs:** `pg_net` calls are fire-and-forget async — the cron job cannot easily assert the Edge Function actually succeeded from SQL alone; failures need to be observed via Edge Function logs / Sentry, not a cron-job status table. The service-role key used for the `net.http_post` auth header must be handled carefully (Vault-backed secret, not a literal in the migration) to avoid leaking write-everywhere credentials into migration history.
- **Neutral / follow-ups:** if a future scheduled job needs guaranteed delivery / retry semantics beyond what `pg_net` offers, that would be grounds for a new ADR evaluating a queue-based approach (e.g. `pgmq`, already available as an extension) instead of extending this pattern.

## Alternatives considered

- **Vercel Cron hitting a Next.js API route** — rejected: introduces a second scheduling surface outside the database, splits "when does this run" across two dashboards (Supabase + Vercel), and this project has no other Vercel Cron usage to justify the split.
- **A long-running Deno cron inside the Edge Function runtime (`Deno.cron`)** — rejected: couples the schedule definition to the function's own code rather than a reviewable migration, and Supabase's own docs steer scheduled Edge Function invocation toward the `pg_cron` + `pg_net` pattern for this exact use case.

## References

- FRESCO-238 (`supabase/migrations/20260823151736_enable_pg_cron_cleanup_abandoned_guest_users.sql`) — prior `pg_cron` precedent (pure-SQL job, no HTTP).
- `list_extensions` (Supabase MCP, 2026-08-23) — confirms `pg_net` available, `pg_cron` already installed.
- FRESCO-241 Stage 1 implementation plan (Jira comment, `spec_implementation_plan` fallback).
