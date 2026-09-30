'use client';

import type { OnboardingStep } from '@/lib/store/onboarding-store';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { IdentityStep } from '@/components/onboarding/identity-step';
import { OnboardingStepDiet } from '@/components/onboarding/onboarding-step-diet';
import { OnboardingStepHousehold } from '@/components/onboarding/onboarding-step-household';
import { OnboardingStepIdentity } from '@/components/onboarding/onboarding-step-identity';
import { OnboardingSummary } from '@/components/onboarding/onboarding-summary';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useGenerateMealPlan } from '@/lib/onboarding/use-generate-meal-plan';
import { useOnboardingFunnelTracking } from '@/lib/onboarding/use-onboarding-funnel-tracking';
import { useOnboardingSessionGate } from '@/lib/onboarding/use-onboarding-session-gate';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/posthog/events';
import { useOnboardingStore } from '@/lib/store/onboarding-store';
import { validateHousehold } from '@/lib/validation/onboarding';

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
  const router = useRouter();
  const { identityResolved, setIdentityResolved, wizardShown } = useOnboardingSessionGate();

  const {
    step,
    adultos,
    ninos,
    presupuestoSemanaEuros,
    planningSelection,
    returnToSummary,
    setStep,
    goToSummary,
  } = useOnboardingStore();

  const household = validateHousehold({ adultos, ninos });
  // FRESCO-371: presupuesto is optional again (A4-H14). Null/unset is valid;
  // a typed-in value still has to be > 0 (matches the DB check constraint).
  const presupuestoValid = presupuestoSemanaEuros === null || presupuestoSemanaEuros > 0;
  // FRESCO-165/166 — QA sweep found "Ninguno" (days) left 0 days selected
  // with "Generar mi menú" still enabled: it generated a menu anyway. Worse,
  // deselecting all 3 meals didn't block generation either, and because
  // `upsertUserProfile()` below persists `planning_selection` BEFORE
  // `generateMealPlan()` runs, a user who reached that state and hit
  // a generation failure (e.g. 409 "plan already exists") was left with a
  // permanently-saved empty preference — `/menu` reads today's meals from
  // that (now-corrupted) preference, not from the real stored plan, so it
  // rendered with zero meal cards and no explanation. Blocking submission
  // here prevents the empty-preference profile write from ever happening.
  const hasInvalidPlanning = Object.values(planningSelection).every(meals => meals.length === 0);

  const { markShouldReset } = useOnboardingFunnelTracking({ identityResolved, step });
  const { isGenerating, generateSuccess, generateError, hasExistingMenu, handleGenerate } = useGenerateMealPlan({ markShouldReset });

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

        <div className="t-stagger-line t-stagger-line--2 mt-6">
          <p data-testid="step_indicator_label" className="text-caption uppercase text-tertiary">
            {step === 4 ? 'Resumen' : `Paso ${step} de 3`}
          </p>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3].map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-surface'}`} />
            ))}
          </div>
        </div>

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

            {step === 4 && generateError && !hasExistingMenu && (
              <div className="mt-4">
                <p data-testid="generate_error_message" role="alert" aria-live="assertive" className="text-body-sm text-error">
                  {generateError}
                </p>
              </div>
            )}

            {/* FRESCO-152: when a plan already exists, the error text stays
            informational but the *action* moves into the primary CTA below
            ("Ver mi menú", de-emphasized) instead of also living here as a
            separate link — one action, not two competing ones. */}
            {step === 4 && hasExistingMenu && (
              <p data-testid="generate_error_message" role="status" aria-live="polite" className="mt-4 text-body-sm text-tertiary">
                {generateError}
              </p>
            )}

            {generateSuccess
              ? (
                  <p data-testid="generate_success_message" role="status" aria-live="polite" className="mt-4 text-body-sm text-primary">
                    Se ha generado tu menú correctamente. Te llevamos a verlo…
                  </p>
                )
              : isGenerating && (
              // ADR-0005: menu-slot selection is now a deterministic algorithm
              // (~2-3s observed live), not a per-call Gemini generation — the
              // old "puede tardar hasta un minuto" copy overstated the real
              // wait once that shipped. Kept the spinner + hint pattern itself
              // (still reassuring during any wait, however short), just
              // corrected what it claims.
                <p data-testid="generating_hint" role="status" aria-live="polite" className="mt-4 text-body-sm text-tertiary">
                  Preparando tu menú…
                </p>
              )}

            <div className="mt-6 flex justify-between">
              <Button
                data-testid="back_button"
                variant="secondary"
                // FRESCO-296: on step 1 "Atrás" is no longer a dead end — it
                // exits the wizard back to the landing page. Steps 2-3 keep
                // walking back through the wizard. FRESCO-755: a step opened
                // from the summary's edit icon returns to the summary instead.
                onClick={() => {
                  if (returnToSummary) {
                    goToSummary();
                  }
                  else if (step === 1) {
                    router.push('/');
                  }
                  else {
                    setStep((step - 1) as OnboardingStep);
                  }
                }}
              >
                Atrás
              </Button>
              {step === 4
                // FRESCO-152: once a plan already exists for this week,
                // "Empezar" can't succeed — the primary action becomes a
                // de-emphasized "Ver mi menú" instead of repeating a CTA that
                // structurally cannot work.
                ? hasExistingMenu
                  ? (
                      <Button
                        data-testid="view_existing_menu_button"
                        variant="ghost"
                        onClick={() => router.push('/menu')}
                      >
                        Ver mi menú
                      </Button>
                    )
                  : (
                      <Button
                        data-testid="generate_menu_button"
                        variant="action"
                        onClick={() => {
                          void handleGenerate();
                        }}
                        disabled={isGenerating || !household.valid || !presupuestoValid || hasInvalidPlanning}
                      >
                        {isGenerating
                          ? (
                              <>
                                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                                {generateSuccess ? '¡Menú generado!' : 'Generando menú…'}
                              </>
                            )
                          : (
                              'Empezar'
                            )}
                      </Button>
                    )
                : step < 3 && !returnToSummary
                  ? (
                      <Button
                        data-testid="next_button"
                        onClick={() => {
                          // FRESCO-366 / FRESCO-371: which wizard steps get abandoned.
                          captureEvent(POSTHOG_EVENTS.ONBOARDING_STEP_COMPLETED, { step, total_steps: 3 });
                          setStep((step + 1) as OnboardingStep);
                        }}
                      >
                        Siguiente
                      </Button>
                    )
                  : (
                      <Button
                        data-testid="view_summary_button"
                        onClick={() => {
                          // Re-confirming an edited step is not a new completion.
                          if (!returnToSummary) {
                            captureEvent(POSTHOG_EVENTS.ONBOARDING_STEP_COMPLETED, { step, total_steps: 3 });
                          }
                          goToSummary();
                        }}
                        disabled={!household.valid || !presupuestoValid || hasInvalidPlanning}
                      >
                        Ver resumen
                      </Button>
                    )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
