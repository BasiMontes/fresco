import { describe, expect, mock, test } from 'bun:test';
import { isEndedSubscription, isTransientStripeError, retrieveLiveSubscription } from './stripe-errors';

/** FRESCO-1002 / ADR-0062 — which Stripe failures the webhook answers 500 for. */

describe('isTransientStripeError', () => {
  test.each(['StripeAPIError', 'StripeConnectionError', 'StripeRateLimitError'])('%s is transient', (type) => {
    expect(isTransientStripeError({ type })).toBe(true);
  });

  test.each([500, 502, 503, 429])('a %i status is transient whatever the class', (statusCode) => {
    expect(isTransientStripeError({ type: 'StripeError', statusCode })).toBe(true);
  });

  test.each([
    ['a bad request', { type: 'StripeInvalidRequestError', statusCode: 400 }],
    ['a missing resource', { type: 'StripeInvalidRequestError', statusCode: 404, code: 'resource_missing' }],
    ['a card error', { type: 'StripeCardError', statusCode: 402 }],
    ['an authentication error', { type: 'StripeAuthenticationError', statusCode: 401 }],
    ['a plain bug', new TypeError('x is undefined')],
    ['a string', 'boom'],
    ['null', null],
  ])('%s is not transient: a retry would repeat it', (_name, error) => {
    expect(isTransientStripeError(error)).toBe(false);
  });
});

describe('isEndedSubscription', () => {
  test.each([['canceled', true], ['incomplete_expired', true], ['active', false], ['trialing', false], ['past_due', false], ['unpaid', false]] as const)('%s -> %p', (status, ended) => {
    expect(isEndedSubscription({ status })).toBe(ended);
  });
});

describe('retrieveLiveSubscription', () => {
  const stripeThatThrows = (error: unknown) => ({ subscriptions: { retrieve: mock(async () => { throw error; }) } }) as unknown as Parameters<typeof retrieveLiveSubscription>[0];

  test('returns the subscription', async () => {
    const stripe = { subscriptions: { retrieve: mock(async () => ({ id: 'sub_1', status: 'active' })) } } as unknown as Parameters<typeof retrieveLiveSubscription>[0];

    expect(await retrieveLiveSubscription(stripe, 'sub_1')).toMatchObject({ id: 'sub_1' });
  });

  test('null when Stripe no longer has it', async () => {
    expect(await retrieveLiveSubscription(stripeThatThrows({ code: 'resource_missing' }), 'sub_1')).toBeNull();
  });

  test('any other failure is thrown for the caller to classify', async () => {
    const outage = { type: 'StripeAPIError', statusCode: 503 };

    await expect(retrieveLiveSubscription(stripeThatThrows(outage), 'sub_1')).rejects.toBe(outage);
  });
});
