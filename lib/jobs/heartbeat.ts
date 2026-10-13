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
