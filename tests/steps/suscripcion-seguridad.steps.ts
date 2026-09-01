import type { APIRequestContext } from '@playwright/test';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { getAccessToken, restHeaders, serviceRoleHeaders } from '../test-helpers';

/**
 * Step definitions for `.context/qa/regression.feature` — @seguridad,
 * FRESCO-360 (audit-4 A4-B1): the payment bypass on the `user_profiles`
 * INSERT path.
 *
 * Reproduces the exploit itself — a brand-new auth user with no profile row
 * `POST`s `{ plan: 'pro' }` with its own token and must be rejected by the
 * `protect_subscription_columns` trigger (now BEFORE INSERT OR UPDATE) — then
 * confirms the legitimate no-plan INSERT onboarding actually does still
 * succeeds at `plan = 'free'`.
 *
 * The reconcile-cron sweep (second safety net) is covered by the
 * `sweepOrphanPaidPlans` unit test, not here — see that scenario's note in
 * the feature file.
 *
 * Pure REST, no browser, no Gemini.
 */

const { Given, When, Then } = createBdd(test);
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

function uniqueEmail(): string {
  return `hola.frescoapp+e2e-sec-${crypto.randomUUID()}@gmail.com`;
}

async function createRawAuthUser(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${SUPABASE_URL}/auth/v1/admin/users`, {
    headers: serviceRoleHeaders(),
    data: { email, password, email_confirm: true },
  });
  if (!res.ok()) { throw new Error(`[suscripcion-seguridad] failed to create auth user: ${res.status()} ${await res.text()}`); }
  return (await res.json() as { id: string }).id;
}

async function deleteRawAuthUser(request: APIRequestContext, userId: string): Promise<void> {
  await request.delete(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { headers: serviceRoleHeaders() });
}

async function readPlan(request: APIRequestContext, headers: Record<string, string>, userId: string): Promise<string | undefined> {
  const res = await request.get(
    `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}&select=plan`,
    { headers },
  );
  const [row] = await res.json() as { plan: string }[];
  return row?.plan;
}

interface BypassCtx {
  userId: string
  email: string
  password: string
  accessToken: string
  insertStatus: number
}
const bypassCtx: BypassCtx = { userId: '', email: '', password: '', accessToken: '', insertStatus: 0 };

Given(/^que una cuenta recién creada todavía no tiene fila de perfil$/, async ({ request }) => {
  bypassCtx.email = uniqueEmail();
  bypassCtx.password = `E2e-Sec-${crypto.randomUUID()}-Aa1!`;
  bypassCtx.userId = await createRawAuthUser(request, bypassCtx.email, bypassCtx.password);
  bypassCtx.accessToken = await getAccessToken(request, bypassCtx.email, bypassCtx.password);
});

When(/^intenta crear su perfil con plan Pro y sin suscripción de Stripe$/, async ({ request }) => {
  const res = await request.post(`${SUPABASE_URL}/rest/v1/user_profiles`, {
    headers: { ...restHeaders(bypassCtx.accessToken), Prefer: 'return=minimal' },
    data: { id: bypassCtx.userId, plan: 'pro', plan_expires_at: '2099-01-01T00:00:00Z' },
  });
  bypassCtx.insertStatus = res.status();
});

Then(/^la base de datos rechaza el INSERT$/, () => {
  expect(bypassCtx.insertStatus).toBeGreaterThanOrEqual(400);
});

Then(/^su perfil sigue sin conceder Pro$/, async ({ request }) => {
  const headers = restHeaders(bypassCtx.accessToken);

  // The malicious INSERT left no row behind…
  expect(await readPlan(request, headers, bypassCtx.userId)).toBeUndefined();

  // …and the legitimate onboarding INSERT (no plan field) still works, at free.
  const legit = await request.post(`${SUPABASE_URL}/rest/v1/user_profiles`, {
    headers: { ...headers, Prefer: 'return=minimal' },
    data: { id: bypassCtx.userId },
  });
  expect(legit.ok()).toBe(true);
  expect(await readPlan(request, headers, bypassCtx.userId)).toBe('free');

  await deleteRawAuthUser(request, bypassCtx.userId);
});
