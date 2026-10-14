-- FRESCO-915 (definitive audit C-11): a heartbeat per scheduled job.
--
-- pg_cron + pg_net fire the Stripe reconciliation route (ADR-0015), but `net.http_get` only
-- enqueues the request: `cron.job_run_details` reports `succeeded` even when the route answers
-- 401 (a rotated CRON_SECRET) or 500. After FRESCO-909 this job is the only safety net for lost
-- payments, so it can stop for weeks without anyone noticing.
--
-- The route writes `last_success_at` itself, once a whole pass has completed. A monitor then
-- reads how old that is: a job that stopped, or that never gets past authentication, goes stale.
--
-- Same locked-down shape as stripe_webhook_events and account_erasures: RLS on, zero policies,
-- no client role ever touches it; only the service-role client in the route does.

create table public.job_heartbeat (
  job             text primary key check (job ~ '^[a-z0-9-]{1,64}$'),
  last_success_at timestamptz not null,
  updated_at      timestamptz not null default now()
);

comment on table public.job_heartbeat is
  'Last successful run of each scheduled job (FRESCO-915). Written by the job itself with the service role; read by the health monitor.';

alter table public.job_heartbeat enable row level security;
revoke all on public.job_heartbeat from public, anon, authenticated;

-- A new public table gets no data privileges by default, not even for service_role. The
-- route upserts (insert + update); select is for the status endpoint and for an operator.
grant select, insert, update on public.job_heartbeat to service_role;
