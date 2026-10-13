import type { OnboardingProfilePayload } from '@/lib/api/user-profile';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';
import { PreferencesForm } from './preferences-form';

/**
 * FRESCO-917 — allergies and diet are health data (GDPR art. 9) and the database
 * refuses to store them without the `health_data` consent. `/profile` therefore
 * asks for it before saving when any of them is filled in and the user has not
 * consented yet. Only `fetch` is stubbed (`/api/consents`).
 */

const realFetch = globalThis.fetch;
let consentCalls: unknown[] = [];
let consentStatus = 200;

const emptyPreferences: OnboardingProfilePayload = {
  num_personas: 2,
  adultos: 2,
  ninos: 0,
  dieta_vegetariano: false,
  dieta_vegano: false,
  dieta_sin_gluten: false,
  dieta_sin_lactosa: false,
  dieta_sin_huevo: false,
  dieta_keto: false,
  dieta_halal: false,
  alergenos: [],
  ingredientes_odiados: [],
  cocinas_favoritas: [],
};

beforeEach(() => {
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

function render(props: { hasHealthDataConsent: boolean, initialPreferences?: OnboardingProfilePayload }) {
  return renderWithProviders(
    <PreferencesForm initialPreferences={props.initialPreferences ?? emptyPreferences} hasHealthDataConsent={props.hasHealthDataConsent} />,
  );
}

describe('PreferencesForm — health data consent', () => {
  test('no consent block while no diet or allergen is selected', () => {
    render({ hasHealthDataConsent: false });

    expect(screen.queryByTestId('health_consent_block')).toBeNull();
  });

  test('picking a diet chip without consent shows the block and keeps the save button disabled', async () => {
    const user = setupUser();
    render({ hasHealthDataConsent: false });

    await user.click(screen.getAllByTestId('preferencia_dieta_option')[0]);

    expect(screen.getByTestId('health_consent_block')).toBeTruthy();
    expect(screen.getByTestId<HTMLInputElement>('health_consent_checkbox').checked).toBe(false);
    expect(screen.getByTestId<HTMLButtonElement>('actualizar_preferencias_button').disabled).toBe(true);
  });

  test('ticking records health_data and enables the save button', async () => {
    const user = setupUser();
    render({ hasHealthDataConsent: false });
    await user.click(screen.getAllByTestId('preferencia_alergeno_option')[0]);

    await user.click(screen.getByTestId('health_consent_checkbox'));

    await waitFor(() => expect(screen.getByTestId<HTMLButtonElement>('actualizar_preferencias_button').disabled).toBe(false));
    expect(consentCalls).toEqual([{ kinds: ['health_data'] }]);
  });

  test('a failed write shows an error and the save button stays disabled', async () => {
    consentStatus = 500;
    const user = setupUser();
    render({ hasHealthDataConsent: false });
    await user.click(screen.getAllByTestId('preferencia_alergeno_option')[0]);

    await user.click(screen.getByTestId('health_consent_checkbox'));

    await waitFor(() => expect(screen.getByTestId('health_consent_error_message')).toBeTruthy());
    expect(screen.getByTestId<HTMLButtonElement>('actualizar_preferencias_button').disabled).toBe(true);
  });

  test('a user who already consented sees the box ticked and can save straight away', async () => {
    const user = setupUser();
    render({ hasHealthDataConsent: true });

    await user.click(screen.getAllByTestId('preferencia_dieta_option')[0]);

    expect(screen.getByTestId<HTMLInputElement>('health_consent_checkbox').checked).toBe(true);
    expect(screen.getByTestId<HTMLButtonElement>('actualizar_preferencias_button').disabled).toBe(false);
    expect(consentCalls).toEqual([]);
  });

  test('a legacy profile with allergens and no consent shows the block from the start', () => {
    render({ hasHealthDataConsent: false, initialPreferences: { ...emptyPreferences, alergenos: ['gluten'] } });

    expect(screen.getByTestId('health_consent_block')).toBeTruthy();
  });
});
