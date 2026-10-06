'use client';

import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { IdentityStep } from '@/components/onboarding/identity-step';
import { OnboardingFooter } from '@/components/onboarding/onboarding-footer';
import { OnboardingGenerateStatus } from '@/components/onboarding/onboarding-generate-status';
import { OnboardingStepDiet } from '@/components/onboarding/onboarding-step-diet';
import { OnboardingStepHousehold } from '@/components/onboarding/onboarding-step-household';
import { OnboardingStepIdentity } from '@/components/onboarding/onboarding-step-identity';
import { OnboardingStepIndicator } from '@/components/onboarding/onboarding-step-indicator';
import { OnboardingSummary } from '@/components/onboarding/onboarding-summary';
import { ProfileLoadError } from '@/components/onboarding/profile-load-error';
import { useGenerateMealPlan } from '@/components/onboarding/use-generate-meal-plan';
import { useOnboardingFunnelTracking } from '@/components/onboarding/use-onboarding-funnel-tracking';
import { useOnboardingSessionGate } from '@/components/onboarding/use-onboarding-session-gate';
import { useOnboardingValidation } from '@/components/onboarding/use-onboarding-validation';
import { Card } from '@/components/ui/card';
import { useOnboardingStore } from '@/lib/store/onboarding-store';

/**
 * `/onboarding` — EPIC-FRESCO-1 (US 1.1/1.2: 3-step onboarding, kept short
 * so a guest doesn't abandon before reaching any value — user-journeys.md
 * Journey 1, Step 2). Single route driving all 3 steps internally (judgment
 * call, see report) rather than separate routes.
 *
 * FRESCO-5 extends this scaffold with the full FR-1.1 profile (diet,
 * allergens, disliked ingredients, favorite cuisines, household size) and
 * persists it to `user_profiles` before continuing on to menu generation.
 * FRESCO-132 adds step 1 (name, sex, goal) — more signal for recommendations.
 * FRESCO-371 cuts the wizard from 4 steps back to 3 (PRD hard limit): cuisines
 * fold into the diet step, and the weekly budget goes optional again (the
 * engine only soft-warns on it — see the note at the budget input).
 * FRESCO-755 adds a read-only summary (`step === 4`) after the 3 data steps:
 * step 3's CTA becomes "Ver resumen" and generation moves to the summary's
 * "Empezar". The summary is not a data step, so the indicator keeps saying
 * "de 3". Its edit icons set `returnToSummary`, which turns each step's CTA
 * into "Ver resumen" and its "Atrás" into a return to the summary.
 *
 * A5-M1 (god-component split): step options/lock-tooltip/each step's JSX,
 * session-gate, funnel-tracking, and generate-meal-plan each own their own
 * file now (`lib/onboarding/*`, `components/onboarding/onboarding-step-*`).
 * This page is left as orchestration: derived cross-step validation (feeds
 * the footer CTA, which lives outside any single step), the wizard shell,
 * and step routing. No behavior change from the original inline
 * implementation.
 */

export default function OnboardingPage() {
  const { identityResolved, setIdentityResolved, wizardShown, profileLoadFailed, retryLoadProfile } = useOnboardingSessionGate();
  const step = useOnboardingStore(state => state.step);

  const validation = useOnboardingValidation();
  const { household, presupuestoValid, hasInvalidPlanning } = validation;

  const { markShouldReset } = useOnboardingFunnelTracking({ identityResolved, step });
  const generation = useGenerateMealPlan({ markShouldReset });
  const { isGenerating, generateSuccess, generateError, hasExistingMenu } = generation;

  // A11y: the wizard swaps step content in place (single route) — without
  // this, a screen-reader/keyboard user gets no signal the content changed
  // when advancing/going back, since focus stays wherever it was.
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [step]);

  // FRESCO-197: identity not resolved yet (session check in flight) — avoid
  // flashing the guest-vs-account choice at a visitor who actually already
  // has a session.
  if (identityResolved === null) {
    return (
      <div data-testid="onboardingPage" className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 py-12">
        <Loader2 data-testid="onboarding_identity_loading" className="size-6 animate-spin text-tertiary" aria-hidden="true" />
      </div>
    );
  }

  // FRESCO-806: could not read the saved profile: never show an empty wizard.
  if (profileLoadFailed) {
    return <ProfileLoadError onRetry={retryLoadProfile} />;
  }

  if (!identityResolved) {
    // FRESCO-479: center the short identity card in the viewport instead of
    // pinning it to the top with a fixed pad, matching the loading branch
    // above. min-h-screen (not h-screen) keeps long content scrollable.
    return (
      <div data-testid="onboardingPage" className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-12">
        <IdentityStep onResolved={() => setIdentityResolved(true)} />
      </div>
    );
  }

  // FRESCO-479: justify-center + min-h-screen self-adjusts — a short step
  // centers, a long step that overflows the viewport lays out from the top
  // (no free space to distribute) so the header is never clipped and the
  // body scrolls normally.
  return (
    <div data-testid="onboardingPage" className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-12">
      <div className={`t-stagger ${wizardShown ? 'is-shown' : ''}`}>
        {/* FRESCO-481: cream negative mark on the near-black dark ground. */}
        <Image
          src="/brand/logo-base.svg"
          alt="Fresco"
          width={100}
          height={30}
          priority
          className="t-stagger-line t-stagger-line--1 mx-auto brand-mark--light"
        />
        <Image
          src="/brand/logo-negativo.svg"
          alt="Fresco"
          width={100}
          height={30}
          priority
          className="t-stagger-line t-stagger-line--1 mx-auto brand-mark--dark"
        />

        <OnboardingStepIndicator step={step} />

        <div className="t-stagger-line t-stagger-line--3 mt-6">
          <Card className="p-6 md:p-8">
            {step === 1 && <OnboardingStepIdentity headingRef={stepHeadingRef} />}
            {step === 2 && <OnboardingStepDiet headingRef={stepHeadingRef} />}
            {step === 3 && (
              <OnboardingStepHousehold
                headingRef={stepHeadingRef}
                household={household}
                presupuestoValid={presupuestoValid}
                hasInvalidPlanning={hasInvalidPlanning}
              />
            )}
            {step === 4 && <OnboardingSummary headingRef={stepHeadingRef} />}

            <OnboardingGenerateStatus
              step={step}
              generateError={generateError}
              generateSuccess={generateSuccess}
              isGenerating={isGenerating}
              hasExistingMenu={hasExistingMenu}
            />

            <OnboardingFooter validation={validation} generation={generation} />
          </Card>
        </div>
      </div>
    </div>
  );
}
