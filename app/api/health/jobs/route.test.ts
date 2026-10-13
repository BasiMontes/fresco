import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { fakeSupabase } from '@/tests/mocks/supabase-query-builder';

/**
 * FRESCO-915 — `GET /api/health/jobs`: the public status of the scheduled jobs. The monitor
 * alerts on the status code alone, so the contract is 200 for ok and pending, 503 for stale or
 * unreadable, and a body that never explains what is broken.
 */

let supa = fakeSupabase();
void mock.module('@/lib/supabase/service', () => ({ createServiceClient: () => supa.client }));

const { GET } = await import('./route');

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
const withHeartbeat = (lastSuccessAt: string | null) => fakeSupabase({
  job_heartbeat: { rows: lastSuccessAt ? [{ job: 'stripe-reconcile', last_success_at: lastSuccessAt }] : [] },
});

beforeEach(() => {
  supa = withHeartbeat(hoursAgo(2));
});

describe('GET /api/health/jobs', () => {
  test('200 and ok when every job reported recently', async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', jobs: { 'stripe-reconcile': 'ok' } });
  });

  test('200 and pending when a job has not reported yet: not an alert before its first run', async () => {
    supa = withHeartbeat(null);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', jobs: { 'stripe-reconcile': 'pending' } });
  });

  test('503 and stale when a job stopped reporting', async () => {
    supa = withHeartbeat(hoursAgo(48));

    const res = await GET();

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'stale', jobs: { 'stripe-reconcile': 'stale' } });
  });

  test('503 and unknown when the heartbeats cannot be read, with no error text in the body', async () => {
    supa = fakeSupabase({ job_heartbeat: { rows: null, selectError: new Error('password authentication failed for user x') } });

    const res = await GET();
    const body = await res.text();

    expect(res.status).toBe(503);
    expect(JSON.parse(body)).toEqual({ status: 'unknown' });
    expect(body).not.toContain('password');
  });

  test('never exposes a timestamp or an age', async () => {
    const body = await (await GET()).text();

    expect(body).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(body).not.toMatch(/hours|age/i);
  });

  test('is never cached', async () => {
    expect((await GET()).headers.get('cache-control')).toBe('no-store');
  });
});
