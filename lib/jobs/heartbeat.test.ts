import { describe, expect, test } from 'bun:test';
import { recordJobHeartbeat, STRIPE_RECONCILE_JOB } from '@/lib/jobs/heartbeat';
import { fakeSupabase } from '@/tests/mocks/supabase-query-builder';

/** FRESCO-915 — a job writes its own heartbeat; the table is closed to clients, so it takes the service-role client. */

type Client = Parameters<typeof recordJobHeartbeat>[0];

describe('recordJobHeartbeat', () => {
  test('upserts one row per job, keyed by job, stamped with now', async () => {
    const db = fakeSupabase();
    const before = Date.now();

    await recordJobHeartbeat(db.client as unknown as Client, STRIPE_RECONCILE_JOB);

    expect(db.upserts).toHaveLength(1);
    expect(db.upserts[0]?.table).toBe('job_heartbeat');
    expect(db.upserts[0]?.options).toEqual({ onConflict: 'job' });
    const payload = db.upserts[0].payload as { job: string, last_success_at: string, updated_at: string };
    expect(payload.job).toBe('stripe-reconcile');
    expect(Date.parse(payload.last_success_at)).toBeGreaterThanOrEqual(before);
    expect(payload.updated_at).toBe(payload.last_success_at);
  });

  test('throws on a write error so the caller can report it', async () => {
    const db = fakeSupabase({ job_heartbeat: { upsertError: new Error('write denied') } });

    await expect(recordJobHeartbeat(db.client as unknown as Client, STRIPE_RECONCILE_JOB)).rejects.toThrow('write denied');
  });
});
