import type { OnboardingValidation } from '@/components/onboarding/use-onboarding-validation';
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import * as posthogEvents from '@/lib/posthog/events';
import { useOnboardingStore } from '@/lib/store/onboarding-store';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { routerMock } from '@/tests/mocks/next-navigation';
import { OnboardingFooter } from './onboarding-footer';

function validation(overrides: Partial<OnboardingValidation> = {}): OnboardingValidation {
  return {
    household: { valid: true },
    presupuestoValid: true,
    hasInvalidPlanning: false,
    healthConsentOk: true,
    ...overrides,
  } as OnboardingValidation;
}

function generation(overrides: Partial<{ isGenerating: boolean, generateSuccess: boolean, hasExistingMenu: boolean, handleGenerate: () => Promise<void> }> = {}) {
  return {
    isGenerating: false,
    generateSuccess: false,
    hasExistingMenu: false,
    handleGenerate: mock(async () => {}),
    ...overrides,
  };
}

function renderFooter(v = validation(), g = generation()) {
  renderWithProviders(<OnboardingFooter validation={v} generation={g} />);
  return g;
}

describe('OnboardingFooter', () => {
  let capture: ReturnType<typeof spyOn>;

  beforeEach(() => {
    useOnboardingStore.getState().reset();
    routerMock.push.mockClear();
    capture = spyOn(posthogEvents, 'captureEvent').mockImplementation(() => {});
  });

  afterEach(() => {
    capture.mockRestore();
  });

  describe('back button', () => {
    test('on step 1 leaves the wizard for the landing page', async () => {
      renderFooter();
      await setupUser().click(screen.getByTestId('back_button'));

      expect(routerMock.push).toHaveBeenCalledWith('/');
    });

    test('on later steps goes one step back', async () => {
      useOnboardingStore.setState({ step: 3 });
      renderFooter();
      await setupUser().click(screen.getByTestId('back_button'));

      expect(useOnboardingStore.getState().step).toBe(2);
      expect(routerMock.push).not.toHaveBeenCalled();
    });

    test('when a step was opened from the summary, returns to the summary', async () => {
      useOnboardingStore.setState({ step: 2, returnToSummary: true });
      renderFooter();
      await setupUser().click(screen.getByTestId('back_button'));

      expect(useOnboardingStore.getState().step).toBe(4);
      expect(useOnboardingStore.getState().returnToSummary).toBe(false);
    });
  });

  describe('steps 1 and 2', () => {
    test('Siguiente advances and reports the completed step', async () => {
      renderFooter();
      await setupUser().click(screen.getByTestId('next_button'));

      expect(useOnboardingStore.getState().step).toBe(2);
      expect(capture).toHaveBeenCalledWith('onboarding_step_completed', { step: 1, total_steps: 3 });
    });

    test('Siguiente is blocked on step 2 until health consent is given', () => {
      useOnboardingStore.setState({ step: 2 });
      renderFooter(validation({ healthConsentOk: false }));

      expect(screen.getByTestId('next_button')).toBeDisabled();
    });

    test('Siguiente stays enabled on step 1 without health consent', () => {
      renderFooter(validation({ healthConsentOk: false }));

      expect(screen.getByTestId('next_button')).toBeEnabled();
    });
  });

  describe('step 3 and edits from the summary', () => {
    test('step 3 offers Ver resumen, which reports the step and opens the summary', async () => {
      useOnboardingStore.setState({ step: 3 });
      renderFooter();
      await setupUser().click(screen.getByTestId('view_summary_button'));

      expect(useOnboardingStore.getState().step).toBe(4);
      expect(capture).toHaveBeenCalledWith('onboarding_step_completed', { step: 3, total_steps: 3 });
    });

    test('re-confirming an edited step does not report a new completion', async () => {
      useOnboardingStore.setState({ step: 1, returnToSummary: true });
      renderFooter();
      await setupUser().click(screen.getByTestId('view_summary_button'));

      expect(useOnboardingStore.getState().step).toBe(4);
      expect(capture).not.toHaveBeenCalled();
    });

    test('Ver resumen is disabled when the household is invalid', () => {
      useOnboardingStore.setState({ step: 3 });
      renderFooter(validation({ household: { valid: false } as OnboardingValidation['household'] }));

      expect(screen.getByTestId('view_summary_button')).toBeDisabled();
    });

    test('Ver resumen is disabled when the budget is invalid', () => {
      useOnboardingStore.setState({ step: 3 });
      renderFooter(validation({ presupuestoValid: false }));

      expect(screen.getByTestId('view_summary_button')).toBeDisabled();
    });

    test('Ver resumen is disabled when planning is invalid', () => {
      useOnboardingStore.setState({ step: 3 });
      renderFooter(validation({ hasInvalidPlanning: true }));

      expect(screen.getByTestId('view_summary_button')).toBeDisabled();
    });

    test('Ver resumen on step 2 needs health consent', () => {
      useOnboardingStore.setState({ step: 2, returnToSummary: true });
      renderFooter(validation({ healthConsentOk: false }));

      expect(screen.getByTestId('view_summary_button')).toBeDisabled();
    });
  });

  describe('summary step', () => {
    beforeEach(() => {
      useOnboardingStore.setState({ step: 4 });
    });

    test('Empezar runs the menu generation', async () => {
      const gen = renderFooter();
      const button = screen.getByTestId('generate_menu_button');
      expect(button).toHaveTextContent('Empezar');

      await setupUser().click(button);

      expect(gen.handleGenerate).toHaveBeenCalledTimes(1);
    });

    test.each([
      ['household', { household: { valid: false } as OnboardingValidation['household'] }],
      ['budget', { presupuestoValid: false }],
      ['planning', { hasInvalidPlanning: true }],
      ['health consent', { healthConsentOk: false }],
    ])('Empezar is disabled when the %s is not valid', (_label, override) => {
      renderFooter(validation(override));

      expect(screen.getByTestId('generate_menu_button')).toBeDisabled();
    });

    test('shows progress and disables the button while generating', () => {
      renderFooter(validation(), generation({ isGenerating: true }));

      const button = screen.getByTestId('generate_menu_button');
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent('Generando menú…');
    });

    test('confirms success once the menu is generated', () => {
      renderFooter(validation(), generation({ isGenerating: true, generateSuccess: true }));

      expect(screen.getByTestId('generate_menu_button')).toHaveTextContent('¡Menú generado!');
    });

    test('with an existing menu, offers Ver mi menú instead of Empezar', async () => {
      renderFooter(validation(), generation({ hasExistingMenu: true }));

      expect(screen.queryByTestId('generate_menu_button')).not.toBeInTheDocument();
      await setupUser().click(screen.getByTestId('view_existing_menu_button'));

      expect(routerMock.push).toHaveBeenCalledWith('/menu');
    });
  });
});
