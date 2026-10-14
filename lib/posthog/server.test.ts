import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { PostHog } from 'posthog-node';
import { captureServerEvent } from './server';

/**
 * FRESCO-919: the stored cookie-banner decision (`user_profiles.analytics_consent`)
 * is read through the same Supabase query chain every caller has; only the final
 * `maybeSingle()` result varies per test.
 */
function fakeSupabase(result: { data: { analytics_consent: boolean | null } | null, error: { message: string } | null }): SupabaseClient<Database> {
  const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => result };
  return { from: () => chain } as unknown as SupabaseClient<Database>;
}

const consented = fakeSupabase({ data: { analytics_consent: true }, error: null });

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
    // FRESCO-796: a spy that outlives its test keeps counting calls, so under a
    // random order the "does nothing" cases saw the calls of the "does it" ones.
    mock.restore();
    if (originalKey === undefined) {
      delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    }
    else {
      process.env.NEXT_PUBLIC_POSTHOG_KEY = originalKey;
    }
  });

  test('captureServerEvent does nothing when NEXT_PUBLIC_POSTHOG_KEY is unset', async () => {
    const captureSpy = spyOn(PostHog.prototype, 'capture');
    await captureServerEvent({ supabase: consented, distinctId: 'user-1', event: 'test_event' });
    expect(captureSpy).not.toHaveBeenCalled();
  });

  test('captureServerEvent calls client.capture + flush when NEXT_PUBLIC_POSTHOG_KEY is set', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';
    const captureSpy = spyOn(PostHog.prototype, 'capture').mockImplementation(() => {});
    const flushSpy = spyOn(PostHog.prototype, 'flush').mockImplementation(async () => {});
    await captureServerEvent({ supabase: consented, distinctId: 'user-1', event: 'test_event', properties: { foo: 'bar' } });
    expect(captureSpy).toHaveBeenCalledWith({ distinctId: 'user-1', event: 'test_event', properties: { foo: 'bar' } });
    expect(flushSpy).toHaveBeenCalled();
  });

  test('captureServerEvent does not throw when the underlying client call fails', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';
    spyOn(PostHog.prototype, 'capture').mockImplementation(() => {
      throw new Error('boom');
    });
    const result = await captureServerEvent({ supabase: consented, distinctId: 'user-1', event: 'test_event' });
    expect(result).toBeUndefined();
  });
  describe('analytics consent (FRESCO-919, ADR-0044)', () => {
    const unconsented = [
      ['the user rejected analytics (false)', fakeSupabase({ data: { analytics_consent: false }, error: null })],
      ['the decision was never synced (null)', fakeSupabase({ data: { analytics_consent: null }, error: null })],
      ['the user has no profile row', fakeSupabase({ data: null, error: null })],
      ['the consent read fails', fakeSupabase({ data: null, error: { message: 'boom' } })],
    ] as const;

    test.each(unconsented)('sends nothing when %s', async (_name, supabase) => {
      process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';
      const captureSpy = spyOn(PostHog.prototype, 'capture').mockImplementation(() => {});
      const flushSpy = spyOn(PostHog.prototype, 'flush').mockImplementation(async () => {});
      spyOn(console, 'error').mockImplementation(() => {});

      await captureServerEvent({ supabase, distinctId: 'user-1', event: 'test_event' });

      expect(captureSpy).not.toHaveBeenCalled();
      expect(flushSpy).not.toHaveBeenCalled();
    });

    test('sends the event only for an explicit true', async () => {
      process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';
      const captureSpy = spyOn(PostHog.prototype, 'capture').mockImplementation(() => {});
      spyOn(PostHog.prototype, 'flush').mockImplementation(async () => {});

      await captureServerEvent({ supabase: consented, distinctId: 'user-1', event: 'test_event' });

      expect(captureSpy).toHaveBeenCalledTimes(1);
    });
  });
});
