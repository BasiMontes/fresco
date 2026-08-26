import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { currentUserId, getAccessToken, postSignedStripeEvent, restHeaders } from '../test-helpers';

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
 * Dedicated account (`PRO_TEST_USER_EMAIL`) — same rationale as
 * `entrega-parcial.steps.ts`/`aprendizaje-pro.steps.ts`: doesn't collide
 * with `@aprendizaje`'s pendiente-slot fixture on `LOCAL_USER_EMAIL`. Only
 * touches `user_profiles.plan`/`stripe_customer_id`/`stripe_subscription_id`/
 * `payment_failed_at` — never `meal_plans`, so it doesn't disturb the
 * learning-history fixture other scenarios on this same account depend on.
 *
 * Known limitation: the last scenario in this file ("Pago sigue fallando
 * revierte a Free") deliberately leaves the account on `plan: 'free'`. Any
 * OTHER scenario on this account that implicitly assumes `plan: 'pro'`
 * without setting it itself would need to run before this file, or reset it
 * — `aprendizaje-pro.steps.ts` already does (force-sets `plan: 'pro'` at the
 * top of its own Given); `generacion-determinista.steps.ts` currently does
 * not. Not fixed here (out of scope) — same class of shared-mutable-state
 * trade-off ADR-0014 already documents for this suite.
 */

const { Given, When, Then } = createBdd(test);

async function proAccessToken(request: Parameters<typeof getAccessToken>[0]): Promise<string> {
  if (!process.env.PRO_TEST_USER_EMAIL || !process.env.PRO_TEST_USER_PASSWORD) {
    throw new Error('PRO_TEST_USER_EMAIL / PRO_TEST_USER_PASSWORD must be set in .env for this scenario.');
  }
  return getAccessToken(request, process.env.PRO_TEST_USER_EMAIL, process.env.PRO_TEST_USER_PASSWORD);
}

/** Deterministic-per-user fake Stripe ids for the events that never round-trip through Stripe's real API (updated/deleted). */
function fakeStripeIds(userId: string): { stripeCustomerId: string, stripeSubscriptionId: string } {
  const suffix = userId.slice(0, 8);
  return { stripeCustomerId: `cus_test_${suffix}`, stripeSubscriptionId: `sub_test_${suffix}` };
}

/** Seeds a known Pro-active baseline (plan + matching Stripe ids) directly via REST, bypassing the webhook — the starting state these scenarios' Given steps need, not what they're testing. */
async function seedProBaseline(
  request: Parameters<typeof getAccessToken>[0],
  headers: Record<string, string>,
  userId: string,
): Promise<{ stripeCustomerId: string, stripeSubscriptionId: string }> {
  const ids = fakeStripeIds(userId);
  const res = await request.patch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}`, {
    headers,
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

async function readProfile(request: Parameters<typeof getAccessToken>[0], headers: Record<string, string>, userId: string) {
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
  Given(givenText, async ({ request }) => {
    const accessToken = await proAccessToken(request);
    const headers = restHeaders(accessToken);
    const userId = await currentUserId(request, accessToken);

    // Clean slate: Free, no Stripe ids — this scenario is what GRANTS Pro.
    const resetRes = await request.patch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}`, {
      headers,
      data: { plan: 'free', stripe_customer_id: null, stripe_subscription_id: null, payment_failed_at: null },
    });
    if (!resetRes.ok()) { throw new Error(`Failed to reset to Free: ${resetRes.status()} ${await resetRes.text()}`); }

    // A REAL Stripe test-mode Customer + Subscription — the webhook handler
    // re-fetches this subscription from Stripe's actual API.
    const StripeModule = (await import('stripe')).default;
    const stripe = new StripeModule(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-07-29.dahlia' });
    const priceId = process.env.STRIPE_PRICE_ID_PRO_MONTH!;
    const customer = await stripe.customers.create({ metadata: { test_user_id: userId } });
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

  Then(thenText, async ({ request }) => {
    const accessToken = await proAccessToken(request);
    const headers = restHeaders(accessToken);
    const userId = await currentUserId(request, accessToken);
    const profile = await readProfile(request, headers, userId);
    expect(profile.plan).toBe('pro');
  });
}

When(/^vuelve a la app$/, async () => { /* no-op — the webhook already wrote the state; nothing to drive here. */ });
When(/^el pago se confirma$/, async () => { /* no-op — same as above, kept for Gherkin readability. */ });

// --- STORY-FRESCO-230: "Renovación mensual mantiene Pro" ---

Given(/^que Laura tiene una suscripción Pro activa$/, async ({ request }) => {
  const accessToken = await proAccessToken(request);
  const headers = restHeaders(accessToken);
  const userId = await currentUserId(request, accessToken);
  await seedProBaseline(request, headers, userId);
});

When(/^se renueva el cobro mensual$/, async ({ request }) => {
  const accessToken = await proAccessToken(request);
  const userId = await currentUserId(request, accessToken);
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

Then(/^sigue teniendo plan Pro sin interrupción$/, async ({ request }) => {
  const accessToken = await proAccessToken(request);
  const headers = restHeaders(accessToken);
  const userId = await currentUserId(request, accessToken);
  const profile = await readProfile(request, headers, userId);
  expect(profile.plan).toBe('pro');
});

// --- STORY-FRESCO-230: "Cancelación revierte a Free al fin del periodo pagado" ---

Given(/^que Laura canceló su suscripción Pro$/, async ({ request }) => {
  const accessToken = await proAccessToken(request);
  const headers = restHeaders(accessToken);
  const userId = await currentUserId(request, accessToken);
  await seedProBaseline(request, headers, userId);
});

When(/^termina el periodo que ya pagó \(customer\.subscription\.deleted\)$/, async ({ request }) => {
  const accessToken = await proAccessToken(request);
  const userId = await currentUserId(request, accessToken);
  const { stripeCustomerId, stripeSubscriptionId } = fakeStripeIds(userId);

  const res = await postSignedStripeEvent(request, 'customer.subscription.deleted', {
    id: stripeSubscriptionId,
    customer: stripeCustomerId,
  });
  if (!res.ok()) { throw new Error(`Webhook rejected deleted event: ${res.status()} ${await res.text()}`); }
});

Then(/^su cuenta pasa a plan Free$/, async ({ request }) => {
  const accessToken = await proAccessToken(request);
  const headers = restHeaders(accessToken);
  const userId = await currentUserId(request, accessToken);
  const profile = await readProfile(request, headers, userId);
  expect(profile.plan).toBe('free');
});

// --- STORY-FRESCO-232: "Pago fallido me avisa" ---

Given(/^que la suscripción Pro de Laura intenta renovarse$/, async ({ request }) => {
  const accessToken = await proAccessToken(request);
  const headers = restHeaders(accessToken);
  const userId = await currentUserId(request, accessToken);
  await seedProBaseline(request, headers, userId);
});

When(/^el cobro falla \(customer\.subscription\.updated con status past_due\)$/, async ({ request }) => {
  const accessToken = await proAccessToken(request);
  const userId = await currentUserId(request, accessToken);
  const { stripeCustomerId, stripeSubscriptionId } = fakeStripeIds(userId);

  const res = await postSignedStripeEvent(request, 'customer.subscription.updated', {
    id: stripeSubscriptionId,
    customer: stripeCustomerId,
    status: 'past_due',
  });
  if (!res.ok()) { throw new Error(`Webhook rejected past_due event: ${res.status()} ${await res.text()}`); }
});

Then(/^ve un aviso en su perfil explicando que el pago falló$/, async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('email_input').fill(process.env.PRO_TEST_USER_EMAIL!);
  await page.getByTestId('password_input').fill(process.env.PRO_TEST_USER_PASSWORD!);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL('**/menu');
  await page.goto('/profile');
  await expect(page.getByTestId('payment_failed_notice')).toBeVisible();
});

// --- STORY-FRESCO-232: "Reintento exitoso restaura Pro sin fricción" ---

Given(/^que Laura tuvo un pago fallido \(payment_failed_at con valor\)$/, async ({ request }) => {
  const accessToken = await proAccessToken(request);
  const headers = restHeaders(accessToken);
  const userId = await currentUserId(request, accessToken);
  const { stripeCustomerId, stripeSubscriptionId } = await seedProBaseline(request, headers, userId);

  const res = await postSignedStripeEvent(request, 'customer.subscription.updated', {
    id: stripeSubscriptionId,
    customer: stripeCustomerId,
    status: 'past_due',
  });
  if (!res.ok()) { throw new Error(`Failed to seed payment-failed baseline: ${res.status()} ${await res.text()}`); }
});

When(/^actualiza su método de pago y el reintento funciona \(status vuelve a active\)$/, async ({ request }) => {
  const accessToken = await proAccessToken(request);
  const userId = await currentUserId(request, accessToken);
  const { stripeCustomerId, stripeSubscriptionId } = fakeStripeIds(userId);
  const priceId = process.env.STRIPE_PRICE_ID_PRO_MONTH!;

  const res = await postSignedStripeEvent(request, 'customer.subscription.updated', {
    id: stripeSubscriptionId,
    customer: stripeCustomerId,
    status: 'active',
    items: { data: [{ price: { id: priceId }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86_400 }] },
  });
  if (!res.ok()) { throw new Error(`Webhook rejected recovery event: ${res.status()} ${await res.text()}`); }
});

Then(/^su cuenta sigue en plan Pro sin interrupción visible$/, async ({ request }) => {
  const accessToken = await proAccessToken(request);
  const headers = restHeaders(accessToken);
  const userId = await currentUserId(request, accessToken);
  const profile = await readProfile(request, headers, userId);
  expect(profile.plan).toBe('pro');
});

Then(/^el aviso de pago fallido desaparece de su perfil$/, async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('email_input').fill(process.env.PRO_TEST_USER_EMAIL!);
  await page.getByTestId('password_input').fill(process.env.PRO_TEST_USER_PASSWORD!);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL('**/menu');
  await page.goto('/profile');
  await expect(page.getByTestId('payment_failed_notice')).toHaveCount(0);
});

// --- STORY-FRESCO-232: "Pago sigue fallando revierte a Free" (@pendiente — never verified before this) ---

Given(/^que el pago de Laura falló y no se resolvió$/, async ({ request }) => {
  const accessToken = await proAccessToken(request);
  const headers = restHeaders(accessToken);
  const userId = await currentUserId(request, accessToken);
  const { stripeCustomerId, stripeSubscriptionId } = await seedProBaseline(request, headers, userId);

  const res = await postSignedStripeEvent(request, 'customer.subscription.updated', {
    id: stripeSubscriptionId,
    customer: stripeCustomerId,
    status: 'past_due',
  });
  if (!res.ok()) { throw new Error(`Failed to seed payment-failed baseline: ${res.status()} ${await res.text()}`); }
});

When(/^Stripe agota los reintentos y emite customer\.subscription\.updated con status unpaid$/, async ({ request }) => {
  const accessToken = await proAccessToken(request);
  const userId = await currentUserId(request, accessToken);
  const { stripeCustomerId, stripeSubscriptionId } = fakeStripeIds(userId);

  const res = await postSignedStripeEvent(request, 'customer.subscription.updated', {
    id: stripeSubscriptionId,
    customer: stripeCustomerId,
    status: 'unpaid',
  });
  if (!res.ok()) { throw new Error(`Webhook rejected unpaid event: ${res.status()} ${await res.text()}`); }
});
