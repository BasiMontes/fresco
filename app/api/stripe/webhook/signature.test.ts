import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test';

/**
 * FRESCO-1100 (audit 8 A8-TEST-01). `route.test.ts` replaces `stripe.webhooks.constructEvent`
 * with a mock, so nothing in it proves that the route hands the RAW body, the header and the
 * signing secret to the verifier in the right order. This file keeps the real Stripe SDK and
 * signs payloads with `generateTestHeaderString`, the way Stripe documents. If someone breaks the
 * wiring (re-serialises the body, swaps the arguments, skips the check), a forged
 * `checkout.session.completed` that grants Pro would stop being refused and these tests go red.
 *
 * It runs in `bun test`, which is the `test:unit` required check on every protected branch.
 *
 * Only what sits AFTER the signature gate is faked: the service client, so a refused request can
 * be shown to touch nothing, and the shared modules `route.test.ts` may have left mocked.
 */

const SECRET = 'whsec_fresco_1100_signing_secret';
const OTHER_SECRET = 'whsec_fresco_1100_other_endpoint';

/** Past the signature gate the route builds a service client; an unhandled event type never uses it. */
const createServiceClient = mock((): unknown => ({}));

const realStripeModule = await import('@/lib/stripe');
// Bun resolves `stripe` to its worker build, whose crypto is async-only; the route calls the
// synchronous `constructEvent`, which is what Node runs in production (the `default` build). Load
// that build, or every request would be refused for the wrong reason and these tests would pass blind.
const { default: NodeStripe } = await import('../../../../node_modules/stripe/esm/stripe.esm.node.js') as { default: typeof import('stripe').default };
const sdk = new NodeStripe('sk_test_fresco_1100', { apiVersion: '2026-10-28.endive' });

void mock.module('@/lib/stripe', () => ({
  ...realStripeModule,
  stripe: sdk,
  resolveWebhookSecret: () => process.env.STRIPE_WEBHOOK_SECRET_DEV,
}));
void mock.module('@/lib/supabase/service', () => ({ createServiceClient }));

const { POST } = await import('./route');

const savedSecret = process.env.STRIPE_WEBHOOK_SECRET_DEV;
afterAll(() => {
  if (savedSecret === undefined) { delete process.env.STRIPE_WEBHOOK_SECRET_DEV; }
  else { process.env.STRIPE_WEBHOOK_SECRET_DEV = savedSecret; }
});

function payloadOf(type: string): string {
  return JSON.stringify({
    id: `evt_1100_${type}`,
    object: 'event',
    type,
    livemode: false,
    data: { object: { id: 'cs_forged', livemode: false, customer: 'cus_forged', payment_status: 'paid' } },
  });
}

function sign(payload: string, secret = SECRET, timestamp?: number): string {
  return sdk.webhooks.generateTestHeaderString({ payload, secret, ...(timestamp ? { timestamp } : {}) });
}

async function post(body: string, headers: Record<string, string>) {
  return POST(new Request('https://test.fresco.local/api/stripe/webhook', { method: 'POST', headers, body }));
}

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET_DEV = SECRET;
  createServiceClient.mockClear();
});

describe('POST /api/stripe/webhook with a real signature (FRESCO-1100)', () => {
  test('a payload signed with the endpoint secret passes the gate', async () => {
    const body = payloadOf('ping.fresco_1100');
    const response = await post(body, { 'stripe-signature': sign(body) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    // Proof the verifier accepted it: only a verified event gets as far as the service client.
    expect(createServiceClient).toHaveBeenCalledTimes(1);
  });

  test('a forged checkout.session.completed with a made-up signature is refused and writes nothing', async () => {
    const body = payloadOf('checkout.session.completed');
    const response = await post(body, { 'stripe-signature': 't=1,v1=deadbeef' });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Firma inválida.' });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  test('a body changed after it was signed is refused', async () => {
    const signed = payloadOf('ping.fresco_1100');
    const tampered = payloadOf('checkout.session.completed');
    const response = await post(tampered, { 'stripe-signature': sign(signed) });
    expect(response.status).toBe(400);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  test('the same JSON re-serialised with other whitespace is refused (the raw bytes are what is signed)', async () => {
    const signed = payloadOf('checkout.session.completed');
    const reformatted = JSON.stringify(JSON.parse(signed), null, 2);
    const response = await post(reformatted, { 'stripe-signature': sign(signed) });
    expect(response.status).toBe(400);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  test('a signature made with another endpoint\'s secret is refused', async () => {
    const body = payloadOf('checkout.session.completed');
    const response = await post(body, { 'stripe-signature': sign(body, OTHER_SECRET) });
    expect(response.status).toBe(400);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  test('a valid signature whose timestamp is outside Stripe\'s tolerance is refused (replay)', async () => {
    const body = payloadOf('checkout.session.completed');
    const tenMinutesAgo = Math.floor(Date.now() / 1000) - 600;
    const response = await post(body, { 'stripe-signature': sign(body, SECRET, tenMinutesAgo) });
    expect(response.status).toBe(400);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  test('a request with no stripe-signature header is refused', async () => {
    const response = await post(payloadOf('checkout.session.completed'), {});
    expect(response.status).toBe(400);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  test('an environment with no signing secret refuses even a well-signed request', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET_DEV;
    const body = payloadOf('ping.fresco_1100');
    const response = await post(body, { 'stripe-signature': sign(body) });
    expect(response.status).toBe(400);
    expect(createServiceClient).not.toHaveBeenCalled();
  });
});
