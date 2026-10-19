/**
 * FRESCO-888 / FRESCO-1008 — the pre-launch waitlist `waitlist_signups`, proven against the real
 * database. What must hold:
 *   1. No browser role can write, read or delete the list (no INSERT grant, no policy).
 *   2. `request_waitlist_signup` is executable by the service role only; it stamps the server's
 *      version and stores the HASH of the token, never anything else.
 *   3. Double opt-in: a new row is unconfirmed; the token confirms it, and the same token removes it.
 *   4. One row per address, whatever its casing; a second request inside 10 minutes is `throttled`
 *      (no second email) and an already confirmed address answers `confirmed`.
 *   5. `check_ip_rate_limit` counts per key and endpoint and refuses past the limit.
 *   6. Malformed emails, tokens and oversized versions are rejected.
 *
 * `service_role` has read-only table access, so a test removes its rows through the token. Runs only
 * with `RUN_DB_INTEGRATION=1` and a reachable local stack: `bun run test:db`.
 */

import { createHash } from 'node:crypto';
import { describe, expect, test } from 'bun:test';
import { createDbTestContext, rest, rpc, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

const CHECK_VIOLATION = '23514';
const PERMISSION_DENIED = '42501';

const code = (res: { body: unknown }) => (res.body as { code?: string }).code;
const freshEmail = () => `waitlist-${crypto.randomUUID()}@example.test`;
const newToken = () => crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const request = async (email: string, tokenHash: string, version = 'v-test') =>
  rpc('request_waitlist_signup', { p_email: email, p_version: version, p_token_hash: tokenHash }, { serviceRole: true });
const rowOf = async (email: string) => {
  const res = await rest('waitlist_signups', { serviceRole: true, query: `email=eq.${email}&select=consent_version,confirm_token_hash,confirmed_at,created_at` });
  return (res.body as Array<{ consent_version: string, confirm_token_hash: string | null, confirmed_at: string | null, created_at: string }>)[0];
};
const remove = async (tokenHash: string) => rpc('remove_waitlist_signup', { p_token_hash: tokenHash }, { serviceRole: true });

describe.skipIf(!(RUN && reachable))('waitlist_signups (real DB)', () => {
  const ctx = createDbTestContext();

  test('the browser roles cannot insert, read, update or delete', async () => {
    const insert = await rest('waitlist_signups', { method: 'POST', prefer: 'return=minimal', body: { email: freshEmail(), consent_version: 'v' } });
    expect(code(insert)).toBe(PERMISSION_DENIED);

    const read = await rest('waitlist_signups', { query: 'select=email' });
    expect(code(read)).toBe(PERMISSION_DENIED);

    const update = await rest('waitlist_signups', { method: 'PATCH', query: 'email=like.*', body: { consent_version: 'tampered' } });
    expect(code(update)).toBe(PERMISSION_DENIED);

    const del = await rest('waitlist_signups', { method: 'DELETE', query: 'email=like.*' });
    expect(code(del)).toBe(PERMISSION_DENIED);
  });

  test('a signed-in user cannot write or read the list either', async () => {
    const user = await ctx.createUser();

    expect(code(await rest('waitlist_signups', { token: user.token, method: 'POST', prefer: 'return=minimal', body: { email: freshEmail(), consent_version: 'v' } }))).toBe(PERMISSION_DENIED);
    expect(code(await rest('waitlist_signups', { token: user.token, query: 'select=email' }))).toBe(PERMISSION_DENIED);
    await ctx.cleanupAll();
  });

  test('the functions are not executable by anon or authenticated', async () => {
    const user = await ctx.createUser();
    const args = { request_waitlist_signup: { p_email: freshEmail(), p_version: 'v', p_token_hash: hash(newToken()) }, confirm_waitlist_signup: { p_token_hash: hash('x') }, remove_waitlist_signup: { p_token_hash: hash('x') }, check_ip_rate_limit: { p_key_hash: hash('k'), p_endpoint: 'e', p_limit: 5 } };

    for (const [fn, fnArgs] of Object.entries(args)) {
      expect(code(await rpc(fn, fnArgs))).toBe(PERMISSION_DENIED);
      expect(code(await rpc(fn, fnArgs, { token: user.token }))).toBe(PERMISSION_DENIED);
    }
    await ctx.cleanupAll();
  });

  test('a request stores the server version and only the hash of the token, unconfirmed', async () => {
    const email = freshEmail();
    const tokenHash = hash(newToken());

    expect((await request(email, tokenHash, 'v-server')).body).toBe('send');

    const row = await rowOf(email);
    expect(row.consent_version).toBe('v-server');
    expect(row.confirm_token_hash).toBe(tokenHash);
    expect(row.confirmed_at).toBeNull();
    expect(Date.now() - new Date(row.created_at).getTime()).toBeLessThan(60_000);
    await remove(tokenHash);
  });

  test('the token confirms the address, and the same token removes it', async () => {
    const email = freshEmail();
    const tokenHash = hash(newToken());
    await request(email, tokenHash);

    expect((await rpc('confirm_waitlist_signup', { p_token_hash: tokenHash }, { serviceRole: true })).body).toBe(true);
    expect((await rowOf(email)).confirmed_at).not.toBeNull();

    expect((await remove(tokenHash)).body).toBe(true);
    expect(await rowOf(email)).toBeUndefined();
  });

  test('an unknown token confirms and removes nothing', async () => {
    const tokenHash = hash(newToken());

    expect((await rpc('confirm_waitlist_signup', { p_token_hash: tokenHash }, { serviceRole: true })).body).toBe(false);
    expect((await remove(tokenHash)).body).toBe(false);
  });

  test('the same address in another casing is throttled inside 10 minutes, and confirmed once it confirms', async () => {
    const email = freshEmail();
    const tokenHash = hash(newToken());
    await request(email, tokenHash);

    expect((await request(email.toUpperCase(), hash(newToken()))).body).toBe('throttled');
    expect((await rowOf(email)).confirm_token_hash).toBe(tokenHash);

    await rpc('confirm_waitlist_signup', { p_token_hash: tokenHash }, { serviceRole: true });
    expect((await request(email, hash(newToken()))).body).toBe('confirmed');
    await remove(tokenHash);
  });

  test('malformed emails, tokens and versions are rejected', async () => {
    for (const email of ['not-an-email', 'a@b', '']) {
      expect(code(await request(email, hash(newToken())))).toBe(CHECK_VIOLATION);
    }
    expect(code(await request(freshEmail(), 'not-a-hash'))).toBe(CHECK_VIOLATION);
    expect(code(await request(freshEmail(), hash(newToken()), 'x'.repeat(61)))).toBe('22023');
  });

  test('check_ip_rate_limit allows up to the limit per key and endpoint, then refuses', async () => {
    const key = hash(`k-${crypto.randomUUID()}`);
    const call = async (endpoint = 'e1') => (await rpc('check_ip_rate_limit', { p_key_hash: key, p_endpoint: endpoint, p_limit: 3 }, { serviceRole: true })).body;

    expect([await call(), await call(), await call(), await call()]).toEqual([true, true, true, false]);
    expect(await call('e2')).toBe(true);
    expect(code(await rpc('check_ip_rate_limit', { p_key_hash: key, p_endpoint: 'e1', p_limit: 0 }, { serviceRole: true }))).toBe('22023');
  });

  test('ip_rate_limits is closed to every browser role', async () => {
    expect(code(await rest('ip_rate_limits', { query: 'select=key_hash' }))).toBe(PERMISSION_DENIED);
  });
});
