import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { PostHog } from 'posthog-node';
import { captureServerEvent } from './server';

/**
 * Guard-logic only — same scope as `events.test.ts`: this ticket (FRESCO-240)
 * is instrumentation, not `posthog-node` SDK behavior. What matters here is
 * the fail-soft contract — `captureServerEvent` must never call into
 * `posthog-node` when `NEXT_PUBLIC_POSTHOG_KEY` is unset, and must never
 * throw even when the underlying client call fails (the Stripe webhook this
 * is called from must never fail a payment-processing response because of an
 * analytics outage).
 */
describe('lib/posthog/server', () => {
  const originalKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    }
    else {
      process.env.NEXT_PUBLIC_POSTHOG_KEY = originalKey;
    }
  });

  test('captureServerEvent does nothing when NEXT_PUBLIC_POSTHOG_KEY is unset', async () => {
    const captureSpy = spyOn(PostHog.prototype, 'capture');
    await captureServerEvent({ distinctId: 'user-1', event: 'test_event' });
    expect(captureSpy).not.toHaveBeenCalled();
  });

  test('captureServerEvent calls client.capture + flush when NEXT_PUBLIC_POSTHOG_KEY is set', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';
    const captureSpy = spyOn(PostHog.prototype, 'capture').mockImplementation(() => {});
    const flushSpy = spyOn(PostHog.prototype, 'flush').mockImplementation(async () => {});
    await captureServerEvent({ distinctId: 'user-1', event: 'test_event', properties: { foo: 'bar' } });
    expect(captureSpy).toHaveBeenCalledWith({ distinctId: 'user-1', event: 'test_event', properties: { foo: 'bar' } });
    expect(flushSpy).toHaveBeenCalled();
  });

  test('captureServerEvent does not throw when the underlying client call fails', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';
    spyOn(PostHog.prototype, 'capture').mockImplementation(() => {
      throw new Error('boom');
    });
    const result = await captureServerEvent({ distinctId: 'user-1', event: 'test_event' });
    expect(result).toBeUndefined();
  });
});
