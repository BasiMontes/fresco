import type { OnboardingStep } from '@/lib/store/onboarding-store';
import { useEffect, useRef } from 'react';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/posthog/events';
import { useOnboardingStore } from '@/lib/store/onboarding-store';

export interface UseOnboardingFunnelTrackingArgs {
  identityResolved: boolean | null
  step: OnboardingStep
}

/**
 * FRESCO-201/FRESCO-366/FRESCO-371 — wizard funnel instrumentation: fires
 * `onboarding_started` once identity resolves, and on unmount either resets
 * the persisted store (success path, via `markShouldReset()`) or fires
 * `onboarding_abandoned` with the last step reached. Extracted from
 * `app/onboarding/page.tsx` (A5-M1, god-component split) — no behavior
 * change from the original inline implementation.
 */
export function useOnboardingFunnelTracking({ identityResolved, step }: UseOnboardingFunnelTrackingArgs) {
  // FRESCO-201: resetting the store synchronously before router.push()
  // re-rendered this still-mounted page at step 1 for the ~1s the /menu
  // navigation took to commit, flashing the wizard back to the start.
  // Deferring the reset to actual unmount (post-navigation) removes the
  // flash while preserving FRESCO-94's intent below.
  const resetOnUnmount = useRef(false);
  // FRESCO-366: whether the `onboarding` funnel step has opened (wizard shown).
  const onboardingStarted = useRef(false);
  // FRESCO-371: last wizard step reached (4 = summary, FRESCO-755) — feeds `onboarding_abandoned` so the
  // funnel can see WHERE people drop.
  const lastStepRef = useRef<OnboardingStep>(1);

  // FRESCO-371: `resetOnUnmount` flips to true only on the success path (right
  // before router.push('/menu')). Any other unmount once the wizard was
  // actually shown — closed the tab's route, hit "Atrás" off step 1,
  // navigated away — is an abandonment. `onboardingStarted` gates it so a
  // bounce off the IdentityStep, before `onboarding_started` ever fired, is
  // not counted.
  useEffect(() => {
    return () => {
      if (resetOnUnmount.current) {
        useOnboardingStore.getState().reset();
      }
      else if (onboardingStarted.current) {
        captureEvent(POSTHOG_EVENTS.ONBOARDING_ABANDONED, {
          step: lastStepRef.current,
          total_steps: 3,
        });
      }
    };
  }, []);

  // FRESCO-366: the `onboarding` funnel step opens the moment the wizard is
  // actually shown (a resolved session, or right after IdentityStep). Fires
  // once — `identityResolved` only ever settles on `true` from here.
  useEffect(() => {
    if (identityResolved === true && !onboardingStarted.current) {
      onboardingStarted.current = true;
      captureEvent(POSTHOG_EVENTS.ONBOARDING_STARTED, { total_steps: 3 });
    }
  }, [identityResolved]);

  useEffect(() => {
    lastStepRef.current = step;
  }, [step]);

  function markShouldReset() {
    resetOnUnmount.current = true;
  }

  return { markShouldReset };
}
