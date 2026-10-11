/**
 * FRESCO-888 — the pre-launch waitlist `waitlist_signups`, proven against the real
 * database. What must hold: the browser roles can ADD an email and nothing else.
 *   1. `anon` inserts `(email, consent_version)`; the database sets id and created_at.
 *   2. `anon` cannot supply created_at or id, so a signup cannot be backdated.
 *   3. `anon` and `authenticated` cannot read, update or delete rows.
 *   4. One row per address, whatever its casing.
 *   5. Malformed emails and oversized versions are rejected by CHECK constraints.
 *
 * The table grants `service_role` read-only access, so the rows these tests add
 * cannot be removed through the API: they use random `.test` addresses and the
 * local stack is rebuilt between CI runs. Runs only with `RUN_DB_INTEGRATION=1`
 * and a reachable local stack — `bun run test:db`.
 */

import { describe, expect, test } from 'bun:test';
import { createDbTestContext, rest, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const CHECK_VIOLATION = '23514';
const PERMISSION_DENIED = '42501';
const UNIQUE_VIOLATION = '23505';

const code = (res: { body: unknown }) => (res.body as { code?: string }).code;
const freshEmail = () => `waitlist-${crypto.randomUUID()}@example.test`;
const signup = async (body: Record<string, unknown>) =>
  rest('waitlist_signups', { method: 'POST', prefer: 'return=minimal', body });

describe.skipIf(!(RUN && reachable))('waitlist_signups (real DB)', () => {
  const ctx = createDbTestContext();

  test('anon adds an email; id and created_at are the database\'s', async () => {
    const email = freshEmail();

    expect((await signup({ email, consent_version: 'v-anon' })).status).toBe(201);

    const stored = await rest('waitlist_signups', { serviceRole: true, query: `email=eq.${email}&select=consent_version,created_at` });
    const row = (stored.body as Array<{ consent_version: string, created_at: string }>)[0];
    expect(row?.consent_version).toBe('v-anon');
    expect(Date.now() - new Date(row.created_at).getTime()).toBeLessThan(60_000);
  });

  test('anon cannot backdate a signup or choose the id', async () => {
    const backdated = await signup({ email: freshEmail(), consent_version: 'v', created_at: '2020-01-01T00:00:00Z' });
    expect(backdated.status).toBe(403);
    expect(code(backdated)).toBe(PERMISSION_DENIED);

    const withId = await signup({ email: freshEmail(), consent_version: 'v', id: crypto.randomUUID() });
    expect(withId.status).toBe(403);
    expect(code(withId)).toBe(PERMISSION_DENIED);
  });

  test('anon cannot read, update or delete the list', async () => {
    const email = freshEmail();
    await signup({ email, consent_version: 'v-private' });

    const read = await rest('waitlist_signups', { query: 'select=email' });
    expect(read.status).toBe(401);
    expect(code(read)).toBe(PERMISSION_DENIED);

    const update = await rest('waitlist_signups', { method: 'PATCH', query: `email=eq.${email}`, body: { consent_version: 'tampered' } });
    expect(code(update)).toBe(PERMISSION_DENIED);

    const remove = await rest('waitlist_signups', { method: 'DELETE', query: `email=eq.${email}` });
    expect(code(remove)).toBe(PERMISSION_DENIED);
  });

  test('a signed-in user cannot read the list either', async () => {
    const user = await ctx.createUser();

    const read = await rest('waitlist_signups', { token: user.token, query: 'select=email' });
    expect(code(read)).toBe(PERMISSION_DENIED);
    await ctx.cleanupAll();
  });

  test('the same address twice is a unique violation, whatever its casing', async () => {
    const email = freshEmail();
    await signup({ email, consent_version: 'v' });

    const again = await signup({ email: email.toUpperCase(), consent_version: 'v' });
    expect(again.status).toBe(409);
    expect(code(again)).toBe(UNIQUE_VIOLATION);
  });

  test('malformed emails and oversized versions are rejected', async () => {
    for (const email of ['not-an-email', 'a@b', '']) {
      expect(code(await signup({ email, consent_version: 'v' }))).toBe(CHECK_VIOLATION);
    }
    expect(code(await signup({ email: freshEmail(), consent_version: 'x'.repeat(61) }))).toBe(CHECK_VIOLATION);
  });
});
