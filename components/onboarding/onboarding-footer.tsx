import type { OnboardingValidation } from '@/components/onboarding/use-onboarding-validation';
import type { OnboardingStep } from '@/lib/store/onboarding-store';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/posthog/events';
import { useOnboardingStore } from '@/lib/store/onboarding-store';

interface OnboardingGeneration {
  isGenerating: boolean
  generateSuccess: boolean
  hasExistingMenu: boolean
  handleGenerate: () => Promise<void>
}

interface OnboardingFooterProps {
  validation: OnboardingValidation
  generation: OnboardingGeneration
}

function BackButton() {
  const router = useRouter();
  const { step, returnToSummary, setStep, goToSummary } = useOnboardingStore();

  return (
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
  );
}

/** Summary step: "Empezar", or "Ver mi menú" once a plan already exists. */
function SummaryAction({ validation, generation }: OnboardingFooterProps) {
  const router = useRouter();
  const { household, presupuestoValid, hasInvalidPlanning, healthConsentOk } = validation;
  const { isGenerating, generateSuccess, hasExistingMenu, handleGenerate } = generation;

  // FRESCO-152: once a plan already exists for this week,
  // "Empezar" can't succeed — the primary action becomes a
  // de-emphasized "Ver mi menú" instead of repeating a CTA that
  // structurally cannot work.
  if (hasExistingMenu) {
    return (
      <Button
        data-testid="view_existing_menu_button"
        variant="ghost"
        onClick={() => router.push('/menu')}
      >
        Ver mi menú
      </Button>
    );
  }

  return (
    <Button
      data-testid="generate_menu_button"
      variant="action"
      onClick={() => {
        void handleGenerate();
      }}
      disabled={isGenerating || !household.valid || !presupuestoValid || hasInvalidPlanning || !healthConsentOk}
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
  );
}

function NextButton({ healthConsentOk }: { healthConsentOk: boolean }) {
  const { step, setStep } = useOnboardingStore();

  return (
    <Button
      data-testid="next_button"
      disabled={step === 2 && !healthConsentOk}
      onClick={() => {
        // FRESCO-366 / FRESCO-371: which wizard steps get abandoned.
        captureEvent(POSTHOG_EVENTS.ONBOARDING_STEP_COMPLETED, { step, total_steps: 3 });
        setStep((step + 1) as OnboardingStep);
      }}
    >
      Siguiente
    </Button>
  );
}

function ViewSummaryButton({ validation }: { validation: OnboardingValidation }) {
  const { step, returnToSummary, goToSummary } = useOnboardingStore();
  const { household, presupuestoValid, hasInvalidPlanning, healthConsentOk } = validation;

  return (
    <Button
      data-testid="view_summary_button"
      onClick={() => {
        // Re-confirming an edited step is not a new completion.
        if (!returnToSummary) {
          captureEvent(POSTHOG_EVENTS.ONBOARDING_STEP_COMPLETED, { step, total_steps: 3 });
        }
        goToSummary();
      }}
      disabled={!household.valid || !presupuestoValid || hasInvalidPlanning || (step === 2 && !healthConsentOk)}
    >
      Ver resumen
    </Button>
  );
}

function PrimaryAction({ validation, generation }: OnboardingFooterProps) {
  const { step, returnToSummary } = useOnboardingStore();

  if (step === 4) {
    return <SummaryAction validation={validation} generation={generation} />;
  }
  if (step < 3 && !returnToSummary) {
    return <NextButton healthConsentOk={validation.healthConsentOk} />;
  }
  return <ViewSummaryButton validation={validation} />;
}

export function OnboardingFooter({ validation, generation }: OnboardingFooterProps) {
  return (
    <div className="mt-6 flex justify-between">
      <BackButton />
      <PrimaryAction validation={validation} generation={generation} />
    </div>
  );
}
