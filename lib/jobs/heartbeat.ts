import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type Client = SupabaseClient<Database>;

/** The Stripe reconciliation cron (ADR-0015): `app/api/cron/stripe-reconcile/route.ts`. */
export const STRIPE_RECONCILE_JOB = 'stripe-reconcile';

/**
 * FRESCO-915 (definitive audit C-11): a job writes its own heartbeat once a whole pass has
 * completed, because `cron.job_run_details` says `succeeded` even when the route answered 401
 * or 500 (`net.http_get` only enqueues). Table access lives here (ADR-0041); the table is closed
 * to client roles, so this takes the service-role client. Throws on a write error; the caller
 * decides whether that may fail the run (it should not).
 */
export async function recordJobHeartbeat(client: Client, job: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await client
    .from('job_heartbeat')
    .upsert({ job, last_success_at: now, updated_at: now }, { onConflict: 'job' });

  if (error) {
    throw error;
  }
}

/**
 * How old a daily heartbeat may be before the job counts as stopped. A healthy daily job is at
 * most about 24 h old; the extra hour absorbs a late enqueue. With the monitor probing hourly, a
 * stopped job raises an alert within roughly 26 h of its last success.
 */
export const STALE_AFTER_HOURS = 25;

/** A weekly job (Sunday 18:00 UTC) is at most 168 h old when healthy, plus the same hour of slack. */
const WEEKLY_STALE_AFTER_HOURS = 169;

/**
 * The jobs the health monitor watches, each with how old its heartbeat may get. Add a job here when
 * it starts writing a heartbeat (FRESCO-1017: the other pg_cron jobs). The writers are the cron
 * route (`recordJobHeartbeat` below), the Edge Functions (`_shared/job-heartbeat.ts`) and the SQL
 * of the two jobs that run inside the database (migration `cron_job_heartbeats`).
 */
export const JOB_STALE_AFTER_HOURS: Readonly<Record<string, number>> = {
  [STRIPE_RECONCILE_JOB]: STALE_AFTER_HOURS,
  'cleanup-abandoned-guest-users': STALE_AFTER_HOURS,
  'purge-waitlist-signups': STALE_AFTER_HOURS,
  'retry-posthog-erasures': STALE_AFTER_HOURS,
  'send-weekly-reengagement-push': WEEKLY_STALE_AFTER_HOURS,
};

export const MONITORED_JOBS: readonly string[] = Object.keys(JOB_STALE_AFTER_HOURS);

/**
 * `pending`: the job has never reported (the table is new, or the job has not run since this was
 * deployed). It is not an alert, or the monitor would fire before the first scheduled run.
 */
export type JobStatus = 'ok' | 'stale' | 'pending';

export function jobStatus({ lastSuccessAt, now = new Date(), staleAfterHours = STALE_AFTER_HOURS }: { lastSuccessAt: string | null, now?: Date, staleAfterHours?: number }): JobStatus {
  if (lastSuccessAt === null) {
    return 'pending';
  }
  const ageHours = (now.getTime() - Date.parse(lastSuccessAt)) / 3_600_000;
  return ageHours > staleAfterHours ? 'stale' : 'ok';
}

/**
 * The status of every monitored job, for the public `/api/health/jobs`. Only statuses leave this
 * function: no timestamps or ages, because a public endpoint should say "ok or not", not explain
 * what is broken. Throws on a read error; the route then answers 503 (the monitor cannot verify).
 */
export async function readJobStatuses(client: Client, now: Date = new Date()): Promise<Record<string, JobStatus>> {
  const { data, error } = await client
    .from('job_heartbeat')
    .select('job, last_success_at')
    .in('job', [...MONITORED_JOBS]);

  if (error) {
    throw error;
  }

  const lastByJob = new Map((data ?? []).map(row => [row.job, row.last_success_at]));
  return Object.fromEntries(MONITORED_JOBS.map(job => [job, jobStatus({ lastSuccessAt: lastByJob.get(job) ?? null, now, staleAfterHours: JOB_STALE_AFTER_HOURS[job] })]));
}
