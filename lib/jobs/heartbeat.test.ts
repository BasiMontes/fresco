import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { JOB_STALE_AFTER_HOURS, jobStatus, MONITORED_JOBS, readJobStatuses, recordJobHeartbeat, STALE_AFTER_HOURS, STRIPE_RECONCILE_JOB } from '@/lib/jobs/heartbeat';
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

const NOW = new Date('2026-10-13T12:00:00Z');
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();
const allJobs = (status: string) => Object.fromEntries(MONITORED_JOBS.map(job => [job, status]));

describe('jobStatus', () => {
  test('a job that has never reported is pending, not an alert', () => {
    expect(jobStatus({ lastSuccessAt: null, now: NOW })).toBe('pending');
  });

  test('a heartbeat from a normal daily cycle is ok', () => {
    expect(jobStatus({ lastSuccessAt: hoursAgo(24), now: NOW })).toBe('ok');
  });

  test('the limit itself is still ok; one minute past it is stale', () => {
    expect(jobStatus({ lastSuccessAt: hoursAgo(STALE_AFTER_HOURS), now: NOW })).toBe('ok');
    expect(jobStatus({ lastSuccessAt: hoursAgo(STALE_AFTER_HOURS + 1 / 60), now: NOW })).toBe('stale');
  });

  test('a job that stopped days ago is stale', () => {
    expect(jobStatus({ lastSuccessAt: hoursAgo(72), now: NOW })).toBe('stale');
  });

  test('the limit leaves room for one daily run plus a late enqueue, and no more', () => {
    expect(STALE_AFTER_HOURS).toBeGreaterThan(24);
    expect(STALE_AFTER_HOURS).toBeLessThanOrEqual(26);
  });
});

describe('per-job staleness windows (FRESCO-1017)', () => {
  test('a weekly job is ok 5 days after its run, where a daily job would be stale', () => {
    const lastSuccessAt = hoursAgo(120);

    expect(jobStatus({ lastSuccessAt, now: NOW })).toBe('stale');
    expect(jobStatus({ lastSuccessAt, now: NOW, staleAfterHours: JOB_STALE_AFTER_HOURS['send-weekly-reengagement-push'] })).toBe('ok');
  });

  test('the weekly window covers a full week plus slack and stops before two', () => {
    const weekly = JOB_STALE_AFTER_HOURS['send-weekly-reengagement-push'];

    expect(weekly).toBeGreaterThan(168);
    expect(weekly).toBeLessThan(2 * 168);
  });

  test('readJobStatuses applies each job\'s own window', async () => {
    const db = fakeSupabase({ job_heartbeat: { rows: MONITORED_JOBS.map(job => ({ job, last_success_at: hoursAgo(120) })) } });

    const statuses = await readJobStatuses(db.client as unknown as Client, NOW);

    expect(statuses['send-weekly-reengagement-push']).toBe('ok');
    expect(statuses['retry-posthog-erasures']).toBe('stale');
  });
});

describe('every monitored job has a writer (FRESCO-1017)', () => {
  const read = (path: string) => readFileSync(path, 'utf8');
  const migration = read('supabase/migrations/20261020100000_cron_job_heartbeats.sql');

  test.each(['cleanup-abandoned-guest-users', 'purge-waitlist-signups'])('%s writes its heartbeat inside its cron command', (job) => {
    expect(MONITORED_JOBS).toContain(job);
    expect(migration).toContain(`values ('${job}', now(), now())`);
  });

  test.each(['retry-posthog-erasures', 'send-weekly-reengagement-push'])('%s writes its heartbeat from its Edge Function', (job) => {
    expect(MONITORED_JOBS).toContain(job);
    expect(read(`supabase/functions/${job}/index.ts`)).toContain('recordJobHeartbeat(serviceClient, FN_NAME, FN_NAME)');
    expect(read(`supabase/functions/${job}/index.ts`)).toContain(`const FN_NAME = '${job}'`);
  });
});

describe('readJobStatuses', () => {
  test('reports a status for every monitored job, ok when it reported recently', async () => {
    const db = fakeSupabase({ job_heartbeat: { rows: [{ job: STRIPE_RECONCILE_JOB, last_success_at: hoursAgo(3) }] } });

    const statuses = await readJobStatuses(db.client as unknown as Client, NOW);

    expect(Object.keys(statuses)).toEqual([...MONITORED_JOBS]);
    expect(statuses[STRIPE_RECONCILE_JOB]).toBe('ok');
  });

  test('a monitored job with no row is pending', async () => {
    const db = fakeSupabase({ job_heartbeat: { rows: [] } });

    expect(await readJobStatuses(db.client as unknown as Client, NOW)).toEqual(allJobs('pending'));
  });

  test('a null result (no rows at all) is pending too', async () => {
    const db = fakeSupabase({ job_heartbeat: { rows: null } });

    expect(await readJobStatuses(db.client as unknown as Client, NOW)).toEqual(allJobs('pending'));
  });

  test('a stale heartbeat is reported as stale', async () => {
    const db = fakeSupabase({ job_heartbeat: { rows: [{ job: STRIPE_RECONCILE_JOB, last_success_at: hoursAgo(48) }] } });

    expect((await readJobStatuses(db.client as unknown as Client, NOW))[STRIPE_RECONCILE_JOB]).toBe('stale');
  });

  test('returns statuses only: no timestamp or age leaves the function', async () => {
    const db = fakeSupabase({ job_heartbeat: { rows: [{ job: STRIPE_RECONCILE_JOB, last_success_at: hoursAgo(3) }] } });

    const serialized = JSON.stringify(await readJobStatuses(db.client as unknown as Client, NOW));

    expect(serialized).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  test('ignores rows of jobs that are not monitored', async () => {
    const db = fakeSupabase({ job_heartbeat: { rows: [{ job: 'someone-elses-job', last_success_at: hoursAgo(1) }] } });

    expect(await readJobStatuses(db.client as unknown as Client, NOW)).toEqual(allJobs('pending'));
  });

  test('throws on a read error so the route can answer 503', async () => {
    const db = fakeSupabase({ job_heartbeat: { rows: null, selectError: new Error('read denied') } });

    await expect(readJobStatuses(db.client as unknown as Client, NOW)).rejects.toThrow('read denied');
  });
});
