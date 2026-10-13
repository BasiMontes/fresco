/**
 * FRESCO-915 (definitive audit C-11) — `job_heartbeat`, the last successful run of each
 * scheduled job, proven against the real database.
 *
 * Pinned here:
 *   1. The table is closed to every client role: a signed-in user cannot read it, forge a
 *      fresh heartbeat to hide a stopped job, or delete one.
 *   2. The service role (the cron route's client) can upsert a job's heartbeat: the second
 *      write for the same job updates the row rather than adding one.
 *   3. A job name is a short slug, so a malformed one is refused.
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. See `tests/db/README.md`.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createDbTestContext, rest, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const PERMISSION_DENIED = '42501';
const CHECK_VIOLATION = '23514';
const JOB = `fresco-915-${Date.now()}`;

async function upsertAsService(row: Record<string, unknown>) {
  return rest('job_heartbeat', {
    method: 'POST',
    serviceRole: true,
    prefer: 'resolution=merge-duplicates,return=minimal',
    query: 'on_conflict=job',
    body: row,
  });
}

describe.skipIf(!(RUN && reachable))('job_heartbeat (real DB)', () => {
  const ctx = createDbTestContext();
  let user: DbTestUser;

  beforeAll(async () => {
    user = await ctx.createUser();
  });

  afterAll(async () => {
    await ctx.cleanupAll();
  });

  test('a signed-in user can neither read, write nor delete the table', async () => {
    const read = await rest('job_heartbeat', { token: user.token, query: 'select=*' });
    expect(read.status).toBe(403);
    expect((read.body as { code?: string }).code).toBe(PERMISSION_DENIED);

    const write = await rest('job_heartbeat', {
      method: 'POST',
      token: user.token,
      prefer: 'return=minimal',
      body: { job: 'stripe-reconcile', last_success_at: new Date().toISOString() },
    });
    expect(write.status).toBe(403);
    expect((write.body as { code?: string }).code).toBe(PERMISSION_DENIED);

    const remove = await rest('job_heartbeat', { method: 'DELETE', token: user.token, query: 'job=eq.stripe-reconcile' });
    expect(remove.status).toBe(403);
  });

  test('the service role records a heartbeat and reads it back', async () => {
    const at = new Date().toISOString();

    expect((await upsertAsService({ job: JOB, last_success_at: at })).status).toBe(201);

    const read = await rest('job_heartbeat', { serviceRole: true, query: `job=eq.${JOB}&select=job,last_success_at` });
    const rows = read.body as Array<{ job: string, last_success_at: string }>;
    expect(rows).toHaveLength(1);
    expect(Date.parse(rows[0].last_success_at)).toBe(Date.parse(at));
  });

  test('a second heartbeat for the same job updates the row instead of adding one', async () => {
    const later = new Date(Date.now() + 60_000).toISOString();

    // PostgREST answers 200, not 201, when the upsert resolves to an update.
    expect((await upsertAsService({ job: JOB, last_success_at: later })).status).toBe(200);

    const read = await rest('job_heartbeat', { serviceRole: true, query: `job=eq.${JOB}&select=last_success_at` });
    const rows = read.body as Array<{ last_success_at: string }>;
    expect(rows).toHaveLength(1);
    expect(Date.parse(rows[0].last_success_at)).toBe(Date.parse(later));
  });

  test.each(['', 'Has Spaces', 'UPPER', 'under_score', 'x'.repeat(65)])('a job name that is not a short slug (%p) is refused', async (job) => {
    const res = await upsertAsService({ job, last_success_at: new Date().toISOString() });

    expect(res.status).toBe(400);
    expect((res.body as { code?: string }).code).toBe(CHECK_VIOLATION);
  });
});
