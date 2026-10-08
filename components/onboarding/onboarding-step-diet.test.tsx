import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { useOnboardingStore } from '@/lib/store/onboarding-store';
import { renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';
import { OnboardingStepDiet } from './onboarding-step-diet';

/**
 * FRESCO-794 (ADR-0040) — allergies and diet are health data (GDPR art. 9), so
 * the diet step asks for explicit consent once the user picks any of them. The
 * wording is provisional. Only `fetch` is stubbed (`/api/consents`).
 */

const realFetch = globalThis.fetch;
let consentCalls: unknown[] = [];
let consentStatus = 200;

beforeEach(() => {
  useOnboardingStore.getState().reset();
  consentCalls = [];
  consentStatus = 200;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    consentCalls.push(JSON.parse(init.body as string));
    return new Response(null, { status: consentStatus });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

function render() {
  return renderWithProviders(<OnboardingStepDiet headingRef={{ current: null }} />);
}

describe('OnboardingStepDiet — health data consent', () => {
  test('no consent block while nothing health-related is selected', () => {
    render();

    expect(screen.queryByTestId('health_consent_block')).toBeNull();
  });

  test('picking an allergen shows the block, unticked, with the hint', async () => {
    const user = setupUser();
    render();

    await user.click(screen.getAllByTestId('alergeno_option')[0]);

    expect(screen.getByTestId('health_consent_block')).toBeTruthy();
    expect(screen.getByTestId<HTMLInputElement>('health_consent_checkbox').checked).toBe(false);
    expect(screen.getByTestId('health_consent_required_hint')).toBeTruthy();
  });

  test('picking a diet chip also shows it (a diet implies allergens, and implied ones are never removed)', async () => {
    const user = setupUser();
    render();

    await user.click(screen.getAllByTestId('dieta_option')[0]);

    expect(screen.getByTestId('health_consent_block')).toBeTruthy();
  });

  test('free text in the diet field shows it too', async () => {
    const user = setupUser();
    render();

    await user.type(screen.getByTestId('dieta_texto_libre_input'), 'celíaca');

    expect(screen.getByTestId('health_consent_block')).toBeTruthy();
  });

  test('ticking records health_data and unlocks the wizard (store flag)', async () => {
    const user = setupUser();
    render();
    await user.click(screen.getAllByTestId('alergeno_option')[0]);

    await user.click(screen.getByTestId('health_consent_checkbox'));

    await waitFor(() => expect(useOnboardingStore.getState().healthDataConsent).toBe(true));
    expect(consentCalls).toEqual([{ kinds: ['health_data'] }]);
    expect(screen.queryByTestId('health_consent_required_hint')).toBeNull();
  });

  test('a failed write shows an error and leaves the consent unticked', async () => {
    consentStatus = 500;
    const user = setupUser();
    render();
    await user.click(screen.getAllByTestId('alergeno_option')[0]);

    await user.click(screen.getByTestId('health_consent_checkbox'));

    await waitFor(() => expect(screen.getByTestId('health_consent_error_message')).toBeTruthy());
    expect(useOnboardingStore.getState().healthDataConsent).toBe(false);
    expect(screen.getByTestId<HTMLInputElement>('health_consent_checkbox').checked).toBe(false);
  });

  test('unticking blocks going on again, without writing anything', async () => {
    useOnboardingStore.setState({ healthDataConsent: true, alergenos: ['gluten'] });
    const user = setupUser();
    render();

    await user.click(screen.getByTestId('health_consent_checkbox'));

    expect(useOnboardingStore.getState().healthDataConsent).toBe(false);
    expect(consentCalls).toHaveLength(0);
  });
});

/**
 * FRESCO-856 — a user who already gave the consent (current texts version) is told
 * so, with the date, instead of facing a box to tick again. Nothing is ticked for
 * them and nothing is written; they can always decide again.
 */
describe('OnboardingStepDiet — consent already given', () => {
  const PRIOR = '2026-10-06T10:00:00Z';

  function withPriorConsent() {
    useOnboardingStore.setState({ healthDataConsent: true, healthConsentPriorAt: PRIOR, alergenos: ['gluten'] });
  }

  test('says when the consent was given and shows no box to tick', () => {
    withPriorConsent();
    render();

    expect(screen.getByTestId('health_consent_prior_notice')).toHaveTextContent('6 de octubre de 2026');
    expect(screen.queryByTestId('health_consent_checkbox')).toBeNull();
    expect(screen.queryByTestId('health_consent_required_hint')).toBeNull();
  });

  test('showing it records nothing', () => {
    withPriorConsent();
    render();

    expect(consentCalls).toHaveLength(0);
  });

  test('"Volver a decidir" brings back an unticked box and blocks going on until it is ticked', async () => {
    withPriorConsent();
    const user = setupUser();
    render();

    await user.click(screen.getByTestId('health_consent_redecide_button'));

    expect(screen.queryByTestId('health_consent_prior_notice')).toBeNull();
    expect(screen.getByTestId<HTMLInputElement>('health_consent_checkbox').checked).toBe(false);
    expect(useOnboardingStore.getState().healthDataConsent).toBe(false);
    expect(useOnboardingStore.getState().healthConsentPriorAt).toBeNull();
    expect(consentCalls).toHaveLength(0);
  });

  test('without a prior consent the box is shown as before', () => {
    useOnboardingStore.setState({ alergenos: ['gluten'] });
    render();

    expect(screen.queryByTestId('health_consent_prior_notice')).toBeNull();
    expect(screen.getByTestId('health_consent_checkbox')).toBeTruthy();
  });
});
