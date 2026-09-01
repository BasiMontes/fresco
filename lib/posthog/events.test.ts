import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import posthog from 'posthog-js';
import { captureEvent, identifyUser, POSTHOG_EVENTS } from './events';

/**
 * Guard-logic only — this ticket (FRESCO-240) is instrumentation, not
 * PostHog SDK behavior. What matters here is the fail-soft contract:
 * neither helper must ever call into posthog-js when
 * `NEXT_PUBLIC_POSTHOG_KEY` is unset (local dev without a PostHog project).
 */
describe('lib/posthog/events', () => {
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

  test('captureEvent does nothing when NEXT_PUBLIC_POSTHOG_KEY is unset', () => {
    const captureSpy = spyOn(posthog, 'capture').mockImplementation(() => ({ uuid: 'test', event: 'test', properties: {} }));
    captureEvent(POSTHOG_EVENTS.SESSION_STARTED);
    expect(captureSpy).not.toHaveBeenCalled();
  });

  test('captureEvent calls posthog.capture when NEXT_PUBLIC_POSTHOG_KEY is set', () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';
    const captureSpy = spyOn(posthog, 'capture').mockImplementation(() => ({ uuid: 'test', event: 'test', properties: {} }));
    captureEvent(POSTHOG_EVENTS.RECIPE_MARKED_COOKED, { source: 'test' });
    expect(captureSpy).toHaveBeenCalledWith(POSTHOG_EVENTS.RECIPE_MARKED_COOKED, { source: 'test' });
  });

  test('identifyUser does nothing when NEXT_PUBLIC_POSTHOG_KEY is unset', () => {
    const identifySpy = spyOn(posthog, 'identify').mockImplementation(() => {});
    identifyUser('user-123');
    expect(identifySpy).not.toHaveBeenCalled();
  });

  test('identifyUser calls posthog.identify when NEXT_PUBLIC_POSTHOG_KEY is set', () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';
    const identifySpy = spyOn(posthog, 'identify').mockImplementation(() => {});
    identifyUser('user-123');
    expect(identifySpy).toHaveBeenCalledWith('user-123', undefined);
  });

  test('identifyUser forwards person properties to posthog.identify (FRESCO-366)', () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';
    const identifySpy = spyOn(posthog, 'identify').mockImplementation(() => {});
    identifyUser('user-123', { plan: 'pro', is_guest: false, signup_method: 'account' });
    expect(identifySpy).toHaveBeenCalledWith('user-123', { plan: 'pro', is_guest: false, signup_method: 'account' });
  });
});
