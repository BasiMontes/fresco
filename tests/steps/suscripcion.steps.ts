import type { Page } from '@playwright/test';
import type { TestUser, TestUserFactory } from '../test-user-factory';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { postSignedStripeEvent, restHeaders, serviceRoleHeaders } from '../test-helpers';

/**
 * Step definitions for `.context/qa/regression.feature` — `@suscripcion`
 * (EPIC-FRESCO-227 / STORY-FRESCO-228/230/231/232). Every one of these
 * scenarios was already verified manually in production on 2026-08-19 (see
 * the per-scenario comment in the feature file) — this converts that
 * one-time verification into a permanent regression, covering Grupo A:
 * webhook-state-transition scenarios only (checkout.session.completed,
 * customer.subscription.updated/.deleted). Grupo B (checkout/portal
 * redirect UI) and Grupo C (trial-without-card session inspection) are a
 * follow-up (FRESCO-277).
 *
 * No Stripe CLI (`stripe listen`) process in CI — every event is a real
 * Stripe payload, signed with the real `STRIPE_WEBHOOK_SECRET` via
 * `postSignedStripeEvent` (see `tests/test-helpers.ts`), POSTed directly to
 * `/api/stripe/webhook`. `checkout.session.completed`'s handler re-fetches
 * the subscription from Stripe's real API (`lib/stripe.ts`
 * `resolveProUpdateFromSession`), so that scenario creates a REAL Stripe
 * test-mode Customer + Subscription first. `customer.subscription.updated`/
 * `.deleted` read `event.data.object` directly with no extra Stripe API
 * call, so those use a synthetic-but-consistent object referencing whatever
 * ids are already on the account's `user_profiles` row.
 *
 * FRESCO-308: used to run every scenario against the single shared
 * `PRO_USER_EMAIL` account — a real risk given how many of these scenarios
 * mutate `user_profiles.plan`/`stripe_customer_id`/`stripe_subscription_id`/
 * `payment_failed_at` on it (the file's own comment used to note the last
 * scenario here deliberately leaves that account on `plan: 'free'`, which
 * any other scenario assuming `plan: 'pro'` would need to work around).
 * Each scenario now creates its OWN throwaway "Laura" via `testUserFactory`
 * (`tests/test-user-factory.ts`), stored in the shared `suscripcionCtx`
 * fixture (`tests/fixtures.ts`) so every Given/When/Then step within that
 * SAME scenario reuses it — never `meal_plans`, so this still doesn't
 * disturb the learning-history fixtures other files seed on their own
 * factory users.
 *
 * Grupo B (FRESCO-277): "Iniciar checkout desde el perfil" and "Acceder a
 * gestión de suscripción" — real click in the app, asserting the full-page
 * redirect lands on a real Stripe-hosted domain (checkout.stripe.com /
 * billing.stripe.com), never filling in the hosted form itself.
 *
 * Grupo C (FRESCO-277): "Trial sin tarjeta" — real POST to
 * `/api/stripe/checkout`, then reads the created Checkout Session back via
 * Stripe's real API. Only `payment_method_collection` is verified this way —
 * `trial_period_days` is a `SessionCreateParams`-only field, Stripe never
 * echoes it back on a Session read, and no real Subscription exists yet at
 * this point (`session.subscription` is `null` until the hosted checkout is
 * actually completed). Deliberately left uncovered rather than driving the
 * real hosted Stripe page's DOM.
 *
 * Grupo D (inside Stripe's own hosted Billing Portal) is out of this
 * ticket's scope — exempt, not ours to test.
 */

const { Given, When, Then } = createBdd(test);

/** Creates this scenario's own throwaway "Laura" and stores it on `suscripcionCtx` — every later Given/When/Then step in the SAME scenario reads it back from there instead of creating another one. */
async function createLaura(testUserFactory: TestUserFactory): Promise<TestUser> {
  return testUserFactory();
}

/** Deterministic-per-user fake Stripe ids for the events that never round-trip through Stripe's real API (updated/deleted). */
function fakeStripeIds(userId: string): { stripeCustomerId: string, stripeSubscriptionId: string } {
  const suffix = userId.slice(0, 8);
  return { stripeCustomerId: `cus_test_${suffix}`, stripeSubscriptionId: `sub_test_${suffix}` };
}

/**
 * Seeds a known Pro-active baseline (plan + matching Stripe ids) directly via
 * REST, bypassing the webhook — the starting state these scenarios' Given
 * steps need, not what they're testing. Must use service-role headers: the
 * `protect_subscription_columns` trigger (`supabase/migrations/20260818190000_...`,
 * ADR-0007) rejects writes to these columns from any other role.
 */
async function seedProBaseline(
  request: Parameters<typeof postSignedStripeEvent>[0],
  userId: string,
): Promise<{ stripeCustomerId: string, stripeSubscriptionId: string }> {
  const ids = fakeStripeIds(userId);
  const res = await request.patch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}`, {
    headers: serviceRoleHeaders(),
    data: {
      plan: 'pro',
      stripe_customer_id: ids.stripeCustomerId,
      stripe_subscription_id: ids.stripeSubscriptionId,
      payment_failed_at: null,
    },
  });
  if (!res.ok()) { throw new Error(`Failed to seed Pro baseline: ${res.status()} ${await res.text()}`); }
  return ids;
}

async function readProfile(request: Parameters<typeof postSignedStripeEvent>[0], headers: Record<string, string>, userId: string) {
  const res = await request.get(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}&select=plan,payment_failed_at`,
    { headers },
  );
  const [profile] = await res.json() as { plan: string, payment_failed_at: string | null }[];
  return profile;
}

// --- STORY-FRESCO-228 / FRESCO-230: "Pago completado activa Pro" / "Pago exitoso activa Pro automáticamente" ---
// Same underlying event (checkout.session.completed) verified twice in
// production per the feature file's own comment — kept as two scenarios
// here too, sharing the mechanic.

for (const [givenText, thenText] of [
  [/^que Laura completó el pago de la suscripción Pro$/, /^su perfil muestra el plan Pro activo$/],
  [/^que Laura completó el pago de su suscripción$/, /^su cuenta pasa a plan Pro sin que tenga que hacer nada más$/],
] as const) {
  Given(givenText, async ({ request, testUserFactory, suscripcionCtx: ctx }) => {
    const testUser = await createLaura(testUserFactory);
    ctx.testUser = testUser;
    const userId = testUser.id;

    // A REAL Stripe test-mode Customer + Subscription — the webhook handler
    // re-fetches this subscription from Stripe's actual API. No reset to
    // Free needed first: this is a brand-new factory user, already Free.
    const StripeModule = (await import('stripe')).default;
    const stripe = new StripeModule(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-07-29.dahlia' });
    const priceId = process.env.STRIPE_PRICE_ID_PRO_MONTH!;
    const customer = await stripe.customers.create({ metadata: { test_user_id: userId } });
    ctx.stripeCustomerIds.push(customer.id); // FRESCO-376: fixture teardown deletes it
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      trial_period_days: 7,
    });

    const checkoutRes = await postSignedStripeEvent(request, 'checkout.session.completed', {
      client_reference_id: userId,
      customer: customer.id,
      subscription: subscription.id,
    });
    if (!checkoutRes.ok()) { throw new Error(`Webhook rejected checkout.session.completed: ${checkoutRes.status()} ${await checkoutRes.text()}`); }
  });

  Then(thenText, async ({ request, suscripcionCtx: ctx }) => {
    const headers = restHeaders(ctx.testUser.accessToken);
    const profile = await readProfile(request, headers, ctx.testUser.id);
    expect(profile.plan).toBe('pro');
  });
}

When(/^vuelve a la app$/, async () => { /* no-op — the webhook already wrote the state; nothing to drive here. */ });
When(/^el pago se confirma$/, async () => { /* no-op — same as above, kept for Gherkin readability. */ });

// --- STORY-FRESCO-230: "Renovación mensual mantiene Pro" ---

Given(/^que Laura tiene una suscripción Pro activa$/, async ({ request, testUserFactory, suscripcionCtx: ctx }) => {
  const testUser = await createLaura(testUserFactory);
  ctx.testUser = testUser;
  await seedProBaseline(request, testUser.id);
});

When(/^se renueva el cobro mensual$/, async ({ request, suscripcionCtx: ctx }) => {
  const userId = ctx.testUser.id;
  const { stripeCustomerId, stripeSubscriptionId } = fakeStripeIds(userId);
  const priceId = process.env.STRIPE_PRICE_ID_PRO_MONTH!;

  const res = await postSignedStripeEvent(request, 'customer.subscription.updated', {
    id: stripeSubscriptionId,
    customer: stripeCustomerId,
    status: 'active',
    items: { data: [{ price: { id: priceId }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86_400 }] },
  });
  if (!res.ok()) { throw new Error(`Webhook rejected renewal event: ${res.status()} ${await res.text()}`); }
});

Then(/^sigue teniendo plan Pro sin interrupción$/, async ({ request, suscripcionCtx: ctx }) => {
  const headers = restHeaders(ctx.testUser.accessToken);
  const profile = await readProfile(request, headers, ctx.testUser.id);
  expect(profile.plan).toBe('pro');
});

// --- STORY-FRESCO-230: "Cancelación revierte a Free al fin del periodo pagado" ---

Given(/^que Laura canceló su suscripción Pro$/, async ({ request, testUserFactory, suscripcionCtx: ctx }) => {
  const testUser = await createLaura(testUserFactory);
  ctx.testUser = testUser;
  await seedProBaseline(request, testUser.id);
});

When(/^termina el periodo que ya pagó \(customer\.subscription\.deleted\)$/, async ({ request, suscripcionCtx: ctx }) => {
  const { stripeCustomerId, stripeSubscriptionId } = fakeStripeIds(ctx.testUser.id);

  const res = await postSignedStripeEvent(request, 'customer.subscription.deleted', {
    id: stripeSubscriptionId,
    customer: stripeCustomerId,
  });
  if (!res.ok()) { throw new Error(`Webhook rejected deleted event: ${res.status()} ${await res.text()}`); }
});

Then(/^su cuenta pasa a plan Free$/, async ({ request, suscripcionCtx: ctx }) => {
  const headers = restHeaders(ctx.testUser.accessToken);
  const profile = await readProfile(request, headers, ctx.testUser.id);
  expect(profile.plan).toBe('free');
});

// --- STORY-FRESCO-232: "Pago fallido me avisa" ---

Given(/^que la suscripción Pro de Laura intenta renovarse$/, async ({ request, testUserFactory, suscripcionCtx: ctx }) => {
  const testUser = await createLaura(testUserFactory);
  ctx.testUser = testUser;
  await seedProBaseline(request, testUser.id);
});

When(/^el cobro falla \(customer\.subscription\.updated con status past_due\)$/, async ({ request, suscripcionCtx: ctx }) => {
  const { stripeCustomerId, stripeSubscriptionId } = fakeStripeIds(ctx.testUser.id);

  const res = await postSignedStripeEvent(request, 'customer.subscription.updated', {
    id: stripeSubscriptionId,
    customer: stripeCustomerId,
    status: 'past_due',
  });
  if (!res.ok()) { throw new Error(`Webhook rejected past_due event: ${res.status()} ${await res.text()}`); }
});

Then(/^ve un aviso en su perfil explicando que el pago falló$/, async ({ page, suscripcionCtx: ctx }) => {
  await page.goto('/login');
  await page.getByTestId('email_input').fill(ctx.testUser.email);
  await page.getByTestId('password_input').fill(ctx.testUser.password);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL('**/menu');
  await page.goto('/profile');
  await expect(page.getByTestId('payment_failed_notice')).toBeVisible();
});

// --- STORY-FRESCO-232: "Reintento exitoso restaura Pro sin fricción" ---

Given(/^que Laura tuvo un pago fallido \(payment_failed_at con valor\)$/, async ({ request, testUserFactory, suscripcionCtx: ctx }) => {
  const testUser = await createLaura(testUserFactory);
  ctx.testUser = testUser;
  const { stripeCustomerId, stripeSubscriptionId } = await seedProBaseline(request, testUser.id);

  const res = await postSignedStripeEvent(request, 'customer.subscription.updated', {
    id: stripeSubscriptionId,
    customer: stripeCustomerId,
    status: 'past_due',
  });
  if (!res.ok()) { throw new Error(`Failed to seed payment-failed baseline: ${res.status()} ${await res.text()}`); }
});

When(/^actualiza su método de pago y el reintento funciona \(status vuelve a active\)$/, async ({ request, suscripcionCtx: ctx }) => {
  const { stripeCustomerId, stripeSubscriptionId } = fakeStripeIds(ctx.testUser.id);
  const priceId = process.env.STRIPE_PRICE_ID_PRO_MONTH!;

  const res = await postSignedStripeEvent(request, 'customer.subscription.updated', {
    id: stripeSubscriptionId,
    customer: stripeCustomerId,
    status: 'active',
    items: { data: [{ price: { id: priceId }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86_400 }] },
  });
  if (!res.ok()) { throw new Error(`Webhook rejected recovery event: ${res.status()} ${await res.text()}`); }
});

Then(/^su cuenta sigue en plan Pro sin interrupción visible$/, async ({ request, suscripcionCtx: ctx }) => {
  const headers = restHeaders(ctx.testUser.accessToken);
  const profile = await readProfile(request, headers, ctx.testUser.id);
  expect(profile.plan).toBe('pro');
});

Then(/^el aviso de pago fallido desaparece de su perfil$/, async ({ page, suscripcionCtx: ctx }) => {
  await page.goto('/login');
  await page.getByTestId('email_input').fill(ctx.testUser.email);
  await page.getByTestId('password_input').fill(ctx.testUser.password);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL('**/menu');
  await page.goto('/profile');
  await expect(page.getByTestId('payment_failed_notice')).toHaveCount(0);
});

// --- STORY-FRESCO-232: "Pago sigue fallando revierte a Free" (@pendiente — never verified before this) ---

Given(/^que el pago de Laura falló y no se resolvió$/, async ({ request, testUserFactory, suscripcionCtx: ctx }) => {
  const testUser = await createLaura(testUserFactory);
  ctx.testUser = testUser;
  const { stripeCustomerId, stripeSubscriptionId } = await seedProBaseline(request, testUser.id);

  const res = await postSignedStripeEvent(request, 'customer.subscription.updated', {
    id: stripeSubscriptionId,
    customer: stripeCustomerId,
    status: 'past_due',
  });
  if (!res.ok()) { throw new Error(`Failed to seed payment-failed baseline: ${res.status()} ${await res.text()}`); }
});

When(/^Stripe agota los reintentos y emite customer\.subscription\.updated con status unpaid$/, async ({ request, suscripcionCtx: ctx }) => {
  const { stripeCustomerId, stripeSubscriptionId } = fakeStripeIds(ctx.testUser.id);

  const res = await postSignedStripeEvent(request, 'customer.subscription.updated', {
    id: stripeSubscriptionId,
    customer: stripeCustomerId,
    status: 'unpaid',
  });
  if (!res.ok()) { throw new Error(`Webhook rejected unpaid event: ${res.status()} ${await res.text()}`); }
});

// --- Grupo B (FRESCO-277) ---
// --- STORY-FRESCO-228: "Iniciar checkout desde el perfil" ---

async function loginAsTestUser(page: Page, testUser: TestUser): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('email_input').fill(testUser.email);
  await page.getByTestId('password_input').fill(testUser.password);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL('**/menu');
}

Given(/^que Laura está en su perfil con plan Free$/, async ({ request, page, testUserFactory, suscripcionCtx: ctx }) => {
  const testUser = await createLaura(testUserFactory);
  ctx.testUser = testUser;

  // Belt-and-braces: a brand-new factory user is already Free with no
  // Stripe ids, but resetting explicitly keeps this step correct even if
  // that default ever changes.
  const resetRes = await request.patch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_profiles?id=eq.${testUser.id}`, {
    headers: serviceRoleHeaders(),
    data: { plan: 'free', stripe_customer_id: null, stripe_subscription_id: null, payment_failed_at: null },
  });
  if (!resetRes.ok()) { throw new Error(`Failed to reset to Free: ${resetRes.status()} ${await resetRes.text()}`); }

  await loginAsTestUser(page, testUser);
  await page.goto('/profile');
});

When(/^toca el botón de actualizar a Pro$/, async ({ page }) => {
  await page.getByTestId('upgrade_to_pro_button').click();
});

Then(/^es llevada a completar el pago de la suscripción Pro en Stripe Checkout real$/, async ({ page }) => {
  await page.waitForURL(/^https:\/\/checkout\.stripe\.com\//);
});

// --- STORY-FRESCO-231: "Acceder a gestión de suscripción" ---

Given(/^su cliente de Stripe existe realmente$/, async ({ request, suscripcionCtx: ctx }) => {
  const userId = ctx.testUser.id;

  const StripeModule = (await import('stripe')).default;
  const stripe = new StripeModule(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-07-29.dahlia' });
  const customer = await stripe.customers.create({ metadata: { test_user_id: userId } });
  ctx.stripeCustomerIds.push(customer.id); // FRESCO-376: fixture teardown deletes it

  // Service-role headers required: `protect_subscription_columns` (ADR-0007).
  const res = await request.patch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}`, {
    headers: serviceRoleHeaders(),
    data: { stripe_customer_id: customer.id },
  });
  if (!res.ok()) { throw new Error(`Failed to attach real Stripe customer: ${res.status()} ${await res.text()}`); }
});

When(/^entra a su perfil y pulsa "Gestionar suscripción"$/, async ({ page, suscripcionCtx: ctx }) => {
  await loginAsTestUser(page, ctx.testUser);
  await page.goto('/profile');
  await page.getByTestId('manage_subscription_button').click();
});

Then(/^puede abrir la gestión de su suscripción en el Billing Portal real de Stripe$/, async ({ page }) => {
  await page.waitForURL(/^https:\/\/billing\.stripe\.com\//);
});

// --- Grupo C (FRESCO-277) ---
// --- STORY-FRESCO-228: "Trial sin tarjeta" ---
// GAP conocido (ver comentario en regression.feature): solo verifica
// payment_method_collection, no trial_period_days -- Stripe no lo
// devuelve al leer una Checkout Session, solo lo acepta como input.

Given(/^que Laura empieza el proceso de actualizar a Pro$/, async ({ page, testUserFactory, suscripcionCtx: ctx }) => {
  const testUser = await createLaura(testUserFactory);
  ctx.testUser = testUser;
  await loginAsTestUser(page, testUser);
});

When(/^llega a la pantalla de pago de Stripe Checkout$/, async ({ page, suscripcionCtx: ctx }) => {
  const response = await page.request.post('/api/stripe/checkout');
  const body = await response.json() as { url?: string, error?: string };
  if (!response.ok() || !body.url) { throw new Error(`Checkout session creation failed: ${response.status()} ${JSON.stringify(body)}`); }

  const sessionId = new URL(body.url).pathname.split('/').pop();
  if (!sessionId) { throw new Error(`Could not extract session id from Checkout url: ${body.url}`); }
  ctx.checkoutSessionId = sessionId;
});

Then(/^se le ofrece un periodo de prueba de 7 días sin necesidad de tarjeta$/, async ({ suscripcionCtx: ctx }) => {
  const StripeModule = (await import('stripe')).default;
  const stripe = new StripeModule(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-07-29.dahlia' });
  const session = await stripe.checkout.sessions.retrieve(ctx.checkoutSessionId);
  expect(session.payment_method_collection).toBe('if_required');
});
