import type { OnboardingStep } from '@/lib/store/onboarding-store';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as events from '@/lib/posthog/events';
import { useOnboardingStore } from '@/lib/store/onboarding-store';
import { renderHook } from '@/tests/component-render';
import { useOnboardingFunnelTracking } from './use-onboarding-funnel-tracking';

// FRESCO-1078 — wizard funnel: `onboarding_started` fires once when the wizard is shown, and on
// leaving the page the store is reset after a success or the abandonment is recorded with the
// last step. A bounce off the guest-or-account choice is not an abandonment.

let captureSpy: ReturnType<typeof spyOn<typeof events, 'captureEvent'>>;
let resetSpy: ReturnType<typeof spyOn<ReturnType<typeof useOnboardingStore.getState>, 'reset'>>;

beforeEach(() => {
  captureSpy = spyOn(events, 'captureEvent').mockImplementation(() => {});
  resetSpy = spyOn(useOnboardingStore.getState(), 'reset').mockImplementation(() => {});
});

afterEach(() => {
  captureSpy.mockRestore();
  resetSpy.mockRestore();
});

const mount = (identityResolved: boolean | null, step: OnboardingStep = 1) =>
  renderHook((props: { identityResolved: boolean | null, step: OnboardingStep }) => useOnboardingFunnelTracking(props), {
    initialProps: { identityResolved, step },
  });

describe('useOnboardingFunnelTracking', () => {
  test('does not fire while the identity is unresolved or the choice screen is up', () => {
    mount(null);
    mount(false);
    expect(captureSpy).not.toHaveBeenCalled();
  });

  test('fires onboarding_started once when the wizard is shown, and not again on re-render', () => {
    const { rerender } = mount(true);
    rerender({ identityResolved: true, step: 2 });
    expect(captureSpy.mock.calls.filter(c => c[0] === 'onboarding_started')).toHaveLength(1);
    expect(captureSpy).toHaveBeenCalledWith('onboarding_started', { total_steps: 3 });
  });

  test('leaving after the wizard started records the abandonment with the last step reached', () => {
    const { rerender, unmount } = mount(true);
    rerender({ identityResolved: true, step: 3 });
    unmount();
    expect(captureSpy).toHaveBeenLastCalledWith('onboarding_abandoned', { step: 3, total_steps: 3 });
    expect(resetSpy).not.toHaveBeenCalled();
  });

  test('leaving before the wizard ever started records nothing', () => {
    const { unmount } = mount(false);
    unmount();
    expect(captureSpy).not.toHaveBeenCalled();
  });

  test('after a success the store is reset on unmount and no abandonment is recorded', () => {
    const { result, unmount } = mount(true);
    result.current.markShouldReset();
    unmount();
    expect(resetSpy).toHaveBeenCalledTimes(1);
    expect(captureSpy.mock.calls.some(c => c[0] === 'onboarding_abandoned')).toBe(false);
  });
});
