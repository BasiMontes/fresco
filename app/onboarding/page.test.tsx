import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import * as generateModule from '@/components/onboarding/use-generate-meal-plan';
import * as funnelModule from '@/components/onboarding/use-onboarding-funnel-tracking';
import * as gateModule from '@/components/onboarding/use-onboarding-session-gate';
import * as validationModule from '@/components/onboarding/use-onboarding-validation';
import { useOnboardingStore } from '@/lib/store/onboarding-store';
import { cleanup, renderWithProviders, screen } from '@/tests/component-render';
import OnboardingPage from './page';
import '@/tests/mocks/next-navigation';

// FRESCO-1079 — /onboarding is orchestration: while the session check runs it shows a spinner, a
// profile that could not be read shows a retry (never an empty wizard that would overwrite allergens),
// a visitor with no session picks guest or account, and everyone else walks the wizard step by step.
// The four hooks are replaced by plain objects; the store and the steps are real.

type Gate = ReturnType<typeof gateModule.useOnboardingSessionGate>;

const gate = (overrides: Partial<Gate> = {}): Gate => ({
  identityResolved: true,
  setIdentityResolved: mock(() => {}),
  wizardShown: true,
  profileLoadFailed: false,
  retryLoadProfile: mock(() => {}),
  ...overrides,
});

let gateSpy: ReturnType<typeof spyOn<typeof gateModule, 'useOnboardingSessionGate'>>;
let validationSpy: ReturnType<typeof spyOn<typeof validationModule, 'useOnboardingValidation'>>;
let funnelSpy: ReturnType<typeof spyOn<typeof funnelModule, 'useOnboardingFunnelTracking'>>;
let generateSpy: ReturnType<typeof spyOn<typeof generateModule, 'useGenerateMealPlan'>>;

beforeEach(() => {
  useOnboardingStore.getState().reset();
  gateSpy = spyOn(gateModule, 'useOnboardingSessionGate').mockReturnValue(gate());
  validationSpy = spyOn(validationModule, 'useOnboardingValidation').mockReturnValue({
    household: { valid: true, message: null },
    presupuestoValid: true,
    hasInvalidPlanning: false,
    healthConsentOk: true,
  });
  funnelSpy = spyOn(funnelModule, 'useOnboardingFunnelTracking').mockReturnValue({ markShouldReset: () => {} });
  generateSpy = spyOn(generateModule, 'useGenerateMealPlan').mockReturnValue({
    isGenerating: false,
    generateSuccess: false,
    generateError: null,
    hasExistingMenu: false,
    handleGenerate: mock(async () => {}),
  });
});

afterEach(() => {
  // Unmount first: restoring the hooks or resetting the store while the page is mounted re-renders it with
  // a different set of hooks than the one it rendered with.
  cleanup();
  for (const spy of [gateSpy, validationSpy, funnelSpy, generateSpy]) { spy.mockRestore(); }
  useOnboardingStore.getState().reset();
});

describe('OnboardingPage states', () => {
  test('while the session is being checked it shows only a spinner, not the guest choice', () => {
    gateSpy.mockReturnValue(gate({ identityResolved: null }));
    renderWithProviders(<OnboardingPage />);
    expect(screen.getByTestId('onboarding_identity_loading')).toBeInTheDocument();
    expect(screen.queryByTestId('nombre_input')).toBeNull();
  });

  test('a profile that could not be read offers a retry, never an empty wizard', () => {
    const retry = mock(() => {});
    gateSpy.mockReturnValue(gate({ profileLoadFailed: true, retryLoadProfile: retry }));
    renderWithProviders(<OnboardingPage />);
    expect(screen.queryByTestId('nombre_input')).toBeNull();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  test('a visitor with no session is offered the guest-or-account choice', () => {
    gateSpy.mockReturnValue(gate({ identityResolved: false }));
    renderWithProviders(<OnboardingPage />);
    expect(screen.getByTestId('onboardingPage')).toBeInTheDocument();
    expect(screen.queryByTestId('nombre_input')).toBeNull();
    expect(screen.queryByTestId('onboarding_identity_loading')).toBeNull();
  });
});

describe('OnboardingPage wizard', () => {
  test('starts on step 1, the identity step, with both brand marks', () => {
    renderWithProviders(<OnboardingPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cuéntanos sobre ti');
    expect(screen.getAllByAltText('Fresco')).toHaveLength(2);
  });

  test('step 2 is the diet step', () => {
    useOnboardingStore.getState().setStep(2);
    renderWithProviders(<OnboardingPage />);
    expect(screen.queryByText('Cuéntanos sobre ti')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  test('step 3 is the household step', () => {
    useOnboardingStore.getState().setStep(3);
    renderWithProviders(<OnboardingPage />);
    expect(screen.getByTestId('adultos_input')).toBeInTheDocument();
  });

  test('step 4 is the summary, and generation errors show under it', () => {
    useOnboardingStore.getState().setStep(4);
    generateSpy.mockReturnValue({ isGenerating: false, generateSuccess: false, generateError: 'No pudimos generar tu menú', hasExistingMenu: false, handleGenerate: mock(async () => {}) });
    renderWithProviders(<OnboardingPage />);
    expect(screen.getByTestId('generate_error_message')).toHaveTextContent('No pudimos generar tu menú');
  });

  test('the funnel tracking is told which step the wizard is on', () => {
    useOnboardingStore.getState().setStep(3);
    renderWithProviders(<OnboardingPage />);
    expect(funnelSpy).toHaveBeenCalledWith({ identityResolved: true, step: 3 });
  });

  test('moving the focus to the step heading when the step changes', () => {
    renderWithProviders(<OnboardingPage />);
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
  });
});
