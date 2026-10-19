import * as realSentry from '@sentry/nextjs';
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as realStripe from '@/lib/stripe';

/**
 * FRESCO-1005 (audit 7b: A7-LAUNCH-01, A7-LAUNCH-02) — a rejected subscription confirmation email
 * is reported and retried, never only logged. The webhook wiring (first failure: Sentry + pending
 * row) is covered in `app/api/stripe/webhook/route.test.ts`; this file covers the retry pass and
 * the content of the email.
 */

const send = mock(async (_p: unknown): Promise<void> => {});
const captureException = mock((_error: unknown, _hint?: unknown) => 'id');
void mock.module('@/lib/email/resend', () => ({ sendSubscriptionConfirmationEmail: send }));
void mock.module('@sentry/nextjs', () => ({ ...realSentry, captureException }));
void mock.module('@/lib/stripe', () => ({ ...realStripe, resolveAppUrl: () => 'https://fresco-pro.vercel.app' }));

const { CONFIRMATION_EMAIL_MAX_ATTEMPTS, confirmationEmailContent, retryPendingConfirmations } = await import('./confirmation-email');

const NOW_S = Math.floor(Date.now() / 1000);

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_1',
    status: 'active',
    trial_end: null,
    items: { data: [{ price: { unit_amount: 499, currency: 'eur', recurring: { interval: 'month' } }, current_period_end: NOW_S + 30 * 86_400 }] },
    ...overrides,
  };
}

interface Row { subscription_id: string, user_id: string, attempts: number }

function fakeClient({ rows, email = 'ana@example.com', selectError = null }: { rows: Row[], email?: string | null, selectError?: Error | null }) {
  const deleted: string[] = [];
  const updated: { id: string, payload: Record<string, unknown> }[] = [];
  const capSeen: unknown[] = [];
  const client = {
    from: (_table: string) => ({
      select: () => ({
        lt: (_column: string, cap: unknown) => {
          capSeen.push(cap);
          return { order: () => ({ limit: async () => (selectError ? { data: null, error: selectError } : { data: rows, error: null }) }) };
        },
      }),
      delete: () => ({ eq: async (_c: string, id: string) => { deleted.push(id); return { error: null }; } }),
      update: (payload: Record<string, unknown>) => ({ eq: async (_c: string, id: string) => { updated.push({ id, payload }); return { error: null }; } }),
    }),
    auth: { admin: { getUserById: async () => (email ? { data: { user: { email } }, error: null } : { data: { user: null }, error: new Error('not found') }) } },
  };
  return { client: client as never, deleted, updated, capSeen };
}

function stripeReturning(value: unknown) {
  return { subscriptions: { retrieve: mock(async () => { if (value instanceof Error) { throw value; } return value; }) } } as never;
}

const row = (attempts = 1): Row => ({ subscription_id: 'sub_1', user_id: 'user_1', attempts });
const emailTags = () => captureException.mock.calls.map(c => (c[1] as { tags: Record<string, string> }).tags);

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue(undefined);
  captureException.mockClear();
});

describe('retryPendingConfirmations', () => {
  test('only rows under the attempt cap are asked for', async () => {
    const { client, capSeen } = fakeClient({ rows: [] });

    await retryPendingConfirmations(client, stripeReturning(subscription()));

    expect(capSeen).toEqual([CONFIRMATION_EMAIL_MAX_ATTEMPTS]);
  });

  test('a send that goes through deletes the row', async () => {
    const { client, deleted } = fakeClient({ rows: [row()] });

    const result = await retryPendingConfirmations(client, stripeReturning(subscription()));

    expect(result).toMatchObject({ tried: 1, sent: 1, failed: 0 });
    expect(deleted).toEqual(['sub_1']);
    expect((send.mock.calls[0][0] as { to: string, manageSubscriptionUrl: string })).toMatchObject({ to: 'ana@example.com', manageSubscriptionUrl: 'https://fresco-pro.vercel.app/profile' });
  });

  test('a send that fails again counts one more attempt, keeps the row, and stays quiet until the cap', async () => {
    send.mockRejectedValue(new Error('Resend rejected: you can only send testing emails to your own email address'));
    const { client, deleted, updated } = fakeClient({ rows: [row(2)] });

    const result = await retryPendingConfirmations(client, stripeReturning(subscription()));

    expect(result).toMatchObject({ failed: 1, gaveUp: 0, sent: 0 });
    expect(deleted).toEqual([]);
    expect(updated).toHaveLength(1);
    expect(updated[0].payload).toMatchObject({ attempts: 3 });
    expect(updated[0].payload.last_error).toContain('Resend rejected');
    expect(captureException).not.toHaveBeenCalled();
  });

  test('the attempt that reaches the cap is reported to Sentry once, with the email tag, and the row is left', async () => {
    send.mockRejectedValue(new Error('resend down'));
    const { client, deleted } = fakeClient({ rows: [row(CONFIRMATION_EMAIL_MAX_ATTEMPTS - 1)] });

    const result = await retryPendingConfirmations(client, stripeReturning(subscription()));

    expect(result).toMatchObject({ failed: 1, gaveUp: 1 });
    expect(deleted).toEqual([]);
    expect(emailTags()).toEqual([{ email: 'subscription-confirmation' }]);
  });

  test('an account with no email counts as a failed attempt', async () => {
    const { client, updated } = fakeClient({ rows: [row()], email: null });

    const result = await retryPendingConfirmations(client, stripeReturning(subscription()));

    expect(result).toMatchObject({ failed: 1, sent: 0 });
    expect(send).not.toHaveBeenCalled();
    expect(updated[0].payload).toMatchObject({ attempts: 2 });
  });

  test.each([['canceled'], ['incomplete_expired']])('a %s subscription needs no confirmation: the row is dropped, nothing is sent', async (status) => {
    const { client, deleted } = fakeClient({ rows: [row()] });

    const result = await retryPendingConfirmations(client, stripeReturning(subscription({ status })));

    expect(result).toMatchObject({ dropped: 1, sent: 0 });
    expect(deleted).toEqual(['sub_1']);
    expect(send).not.toHaveBeenCalled();
  });

  test('a subscription Stripe no longer has is dropped', async () => {
    const { client, deleted } = fakeClient({ rows: [row()] });

    const result = await retryPendingConfirmations(client, stripeReturning(Object.assign(new Error('No such subscription'), { code: 'resource_missing' })));

    expect(result).toMatchObject({ dropped: 1 });
    expect(deleted).toEqual(['sub_1']);
  });

  test('a Stripe outage leaves the row untouched and does not burn an attempt', async () => {
    const { client, deleted, updated } = fakeClient({ rows: [row(2)] });

    const result = await retryPendingConfirmations(client, stripeReturning(Object.assign(new Error('stripe 503'), { type: 'StripeAPIError', statusCode: 503 })));

    expect(result).toMatchObject({ skipped: 1, failed: 0 });
    expect(deleted).toEqual([]);
    expect(updated).toEqual([]);
  });

  test('one bad row does not stop the next', async () => {
    const { client, deleted } = fakeClient({ rows: [{ ...row(), subscription_id: 'sub_bad' }, { ...row(), subscription_id: 'sub_ok' }] });
    const stripe = { subscriptions: { retrieve: mock(async (id: string) => { if (id === 'sub_bad') { throw new Error('boom'); } return subscription({ id }); }) } } as never;

    const result = await retryPendingConfirmations(client, stripe);

    expect(result).toMatchObject({ tried: 2, sent: 1, failed: 1 });
    expect(deleted).toEqual(['sub_ok']);
  });

  test('throws when the pending rows cannot be listed, so the cron reports it', async () => {
    const { client } = fakeClient({ rows: [], selectError: new Error('relation does not exist') });

    await expect(retryPendingConfirmations(client, stripeReturning(subscription()))).rejects.toThrow('relation does not exist');
  });
});

describe('confirmationEmailContent', () => {
  test('a monthly subscription: price of one period, the period, the next charge, no trial', () => {
    const content = confirmationEmailContent(subscription() as never);

    expect(content.priceFormatted).toContain('4,99');
    expect(content.interval).toBe('month');
    expect(content).not.toHaveProperty('trialDays');
  });

  test('taxIncluded follows the Price tax_behavior: only inclusive says so (FRESCO-1004)', () => {
    const withTax = (taxBehavior: string | null) => confirmationEmailContent(subscription({
      items: { data: [{ price: { unit_amount: 499, currency: 'eur', recurring: { interval: 'month' }, tax_behavior: taxBehavior }, current_period_end: NOW_S + 30 * 86_400 }] },
    }) as never);

    expect(withTax('inclusive').taxIncluded).toBe(true);
    expect(withTax('exclusive').taxIncluded).toBe(false);
    expect(withTax('unspecified').taxIncluded).toBe(false);
    expect(withTax(null).taxIncluded).toBe(false);
  });

  test('an annual subscription says year', () => {
    const content = confirmationEmailContent(subscription({
      items: { data: [{ price: { unit_amount: 4999, currency: 'eur', recurring: { interval: 'year' } }, current_period_end: NOW_S + 365 * 86_400 }] },
    }) as never);

    expect(content.interval).toBe('year');
    expect(content.priceFormatted).toContain('49,99');
  });

  test('a trial reports the trial length and its end as the first charge date', () => {
    const trialEnd = NOW_S + 7 * 86_400;
    const content = confirmationEmailContent(subscription({ status: 'trialing', trial_end: trialEnd }) as never);

    expect(content.trialDays).toBe(7);
    expect(content.nextRenewalDateFormatted).toBe(new Date(trialEnd * 1000).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }));
  });

  test('throws rather than invent a date when the subscription has none', () => {
    expect(() => confirmationEmailContent(subscription({ status: 'trialing', trial_end: null }) as never)).toThrow('trial_end');
  });
});
