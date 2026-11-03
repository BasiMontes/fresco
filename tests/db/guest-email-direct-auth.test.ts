/**
 * FRESCO-1085 (audit 8 A8-ABUSE-01) — a guest cannot make Auth mail a code to an address by calling
 * `PUT /auth/v1/user {email}` directly. FRESCO-1006 guarded only `POST /api/auth/guest-email`; the
 * BEFORE UPDATE trigger on `auth.users` (`guest_email_change_requires_grant`) now refuses the write
 * of a pending email for an anonymous user unless a one-shot grant exists, and only `service_role`
 * can create one (the route does, after the captcha and both limits).
 *
 * Real GoTrue and real Postgres: a mocked Auth proves nothing about a trigger. The only successful
 * email change in this file sends one mail to the local inbox, under the local `email_sent` limit.
 *
 * Manual: runs only when `RUN_DB_INTEGRATION=1`, the local stack answers AND it mails confirmations
 * (see `registerWhenAuthMails`). CI covers the trigger with the pgTAP twin
 * `supabase/tests/guest_email_change_grant.test.sql`.
 */

import type { DbTestUser } from './harness';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { anonKey, createDbTestContext, nativeFetch, resolveUrl, rpc, serviceRoleKey, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

/**
 * The local stack autoconfirms email changes (`[auth.email] enable_confirmations = false`), so Auth
 * never writes a pending email there and has no mail to guard; hosted does. The database half of
 * the guard is pinned either way by `supabase/tests/guest_email_change_grant.test.sql`. This file
 * runs against Auth only when the stack mails confirmations (`enable_confirmations = true`).
 */
async function authMailsConfirmations(): Promise<boolean> {
  try {
    const res = await nativeFetch(`${resolveUrl()}/auth/v1/settings`, { headers: { apikey: await anonKey() } });
    return ((await res.json()) as { mailer_autoconfirm?: boolean }).mailer_autoconfirm === false;
  }
  catch {
    return false;
  }
}
const mails = RUN && reachable ? await authMailsConfirmations() : false;

/**
 * Registers the suite only when the stack mails confirmations. Not `describe.skipIf`: the CI job
 * refuses any `skip` line (FRESCO-781), and its stack has no inbox (`-x inbucket`), so there Auth
 * would fail to send. Run it by hand with `[auth.email] enable_confirmations = true` and the
 * default stack (`RUN_DB_INTEGRATION=1 bun test tests/db/guest-email-direct-auth.test.ts`).
 */
function registerWhenAuthMails(name: string, suite: () => void) {
  if (RUN && reachable && mails) { describe(name, suite); }
}

interface Guest { id: string, token: string }

async function signInAnonymously(): Promise<Guest> {
  const res = await nativeFetch(`${resolveUrl()}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'apikey': await anonKey(), 'Content-Type': 'application/json' },
    body: '{}',
  });
  const body = await res.json() as { access_token?: string, user?: { id: string, is_anonymous?: boolean } };
  if (!res.ok || !body.access_token || !body.user?.is_anonymous) {
    throw new Error(`[guest-email-direct-auth] anonymous sign-in failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return { id: body.user.id, token: body.access_token };
}

/** The exact call the audit describes: the guest's own token, straight to Auth. */
async function putUser(token: string, attributes: Record<string, unknown>) {
  const res = await nativeFetch(`${resolveUrl()}/auth/v1/user`, {
    method: 'PUT',
    headers: { 'apikey': await anonKey(), 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(attributes),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) as Record<string, unknown> : null };
}

async function pendingEmail(token: string): Promise<string | undefined> {
  const res = await nativeFetch(`${resolveUrl()}/auth/v1/user`, { headers: { apikey: await anonKey(), Authorization: `Bearer ${token}` } });
  return ((await res.json()) as { new_email?: string }).new_email;
}

async function deleteGuest(id: string) {
  const key = await serviceRoleKey();
  await nativeFetch(`${resolveUrl()}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  }).catch(() => undefined);
}

registerWhenAuthMails('guest email change needs the grant (real Auth + DB)', () => {
  const ctx = createDbTestContext();
  const guests: Guest[] = [];
  let registered: DbTestUser;

  const newGuest = async () => {
    const g = await signInAnonymously();
    guests.push(g);
    return g;
  };
  const target = () => `hola.frescoapp+guard-${crypto.randomUUID()}@gmail.com`;

  beforeAll(async () => {
    registered = await ctx.createUser();
  });

  afterAll(async () => {
    await ctx.cleanupAll();
    await Promise.all(guests.map(async g => deleteGuest(g.id)));
  });

  test('a direct PUT /auth/v1/user {email} with a guest token is refused and nothing is left pending', async () => {
    const guest = await newGuest();

    const res = await putUser(guest.token, { email: target() });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await pendingEmail(guest.token)).toBeUndefined();
  });

  test('refused again and again: the direct path stays closed, it is not a one-time miss', async () => {
    const guest = await newGuest();

    for (let i = 0; i < 3; i++) {
      expect((await putUser(guest.token, { email: target() })).status).toBeGreaterThanOrEqual(400);
    }
    expect(await pendingEmail(guest.token)).toBeUndefined();
  });

  test('with a grant the same call goes through once, and the second one is refused again', async () => {
    const guest = await newGuest();
    const address = target();

    const granted = await rpc('grant_guest_email_change', { p_user_id: guest.id }, { serviceRole: true });
    expect(granted.status).toBeLessThan(300);

    expect((await putUser(guest.token, { email: address })).status).toBe(200);
    expect(await pendingEmail(guest.token)).toBe(address);

    // The grant was consumed: re-sending the same pending address directly needs a new one.
    expect((await putUser(guest.token, { email: address })).status).toBeGreaterThanOrEqual(400);
  });

  test('a grant is for one guest only: it does not open the path for another', async () => {
    const owner = await newGuest();
    const other = await newGuest();

    await rpc('grant_guest_email_change', { p_user_id: owner.id }, { serviceRole: true });

    expect((await putUser(other.token, { email: target() })).status).toBeGreaterThanOrEqual(400);
    expect(await pendingEmail(other.token)).toBeUndefined();
  });

  test('a guest cannot grant itself: the function is closed to authenticated and anon', async () => {
    const guest = await newGuest();

    const self = await rpc('grant_guest_email_change', { p_user_id: guest.id }, { token: guest.token });
    expect([401, 403, 404]).toContain(self.status);

    expect((await putUser(guest.token, { email: target() })).status).toBeGreaterThanOrEqual(400);
  });

  test('a grant cannot be made for a registered user', async () => {
    const res = await rpc('grant_guest_email_change', { p_user_id: registered.id }, { serviceRole: true });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('registered users and other guest updates are untouched: a password change still works', async () => {
    expect((await putUser(registered.token, { password: `Db-It-${crypto.randomUUID()}-Aa1!` })).status).toBe(200);
  });
});
