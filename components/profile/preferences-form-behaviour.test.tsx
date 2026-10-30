import type { OnboardingProfilePayload } from '@/lib/api/user-profile';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as clientApi from '@/lib/client-api/user-profile';
import { renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';
import { PreferencesForm } from './preferences-form';

/**
 * FRESCO-1072 (coverage tranche 4) — what `preferences-form.test.tsx` does not pin: the diet and allergen
 * rules (a diet adds the allergens it implies and locks them; a vegan is always vegetarian), the dirty
 * gate of the save button, and the save itself with its success and failure states. These decide what
 * the recipe filter receives, so they are the rules worth a test. `fetch` is never reached: the consent
 * is already given, and the save goes through the stubbed `upsertUserProfile`.
 */

const PREFERENCES: OnboardingProfilePayload = {
  num_personas: 3,
  adultos: 2,
  ninos: 1,
  dieta_vegetariano: false,
  dieta_vegano: false,
  dieta_sin_gluten: false,
  dieta_sin_lactosa: false,
  dieta_sin_huevo: false,
  dieta_keto: false,
  dieta_halal: false,
  alergenos: [],
  ingredientes_odiados: ['cebolla'],
  cocinas_favoritas: ['española'],
};

let upsert: ReturnType<typeof spyOn<typeof clientApi, 'upsertUserProfile'>>;
let consoleError: ReturnType<typeof spyOn<typeof console, 'error'>>;

beforeEach(() => {
  upsert = spyOn(clientApi, 'upsertUserProfile').mockResolvedValue(undefined);
  consoleError = spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  upsert.mockRestore();
  consoleError.mockRestore();
});

function renderForm(initialPreferences: OnboardingProfilePayload = PREFERENCES) {
  return renderWithProviders(<PreferencesForm initialPreferences={initialPreferences} hasHealthDataConsent />);
}

const dieta = (label: string) => screen.getAllByTestId('preferencia_dieta_option').find(button => button.textContent?.trim() === label)!;
const alergeno = (label: string) => screen.getAllByTestId('preferencia_alergeno_option').find(button => button.textContent?.trim() === label)!;
const saveButton = () => screen.getByTestId<HTMLButtonElement>('actualizar_preferencias_button');
// Plain booleans on purpose: a failing jest-dom matcher makes bun print the whole DOM, which can take minutes.
const pressed = (button: HTMLElement) => button.getAttribute('aria-pressed') === 'true';
const locked = (button: HTMLElement) => (button as HTMLButtonElement).disabled;

describe('PreferencesForm — the diet and allergen rules', () => {
  test('a vegan is always vegetarian: choosing Vegano selects Vegetariano and locks it', async () => {
    const user = setupUser();
    renderForm();

    await user.click(dieta('Vegano'));

    expect(pressed(dieta('Vegano'))).toBe(true);
    expect(pressed(dieta('Vegetariano'))).toBe(true);
    expect(locked(dieta('Vegetariano'))).toBe(true);
  });

  test('a locked Vegetariano cannot be switched off while Vegano is on', async () => {
    const user = setupUser();
    renderForm({ ...PREFERENCES, dieta_vegano: true, dieta_vegetariano: true });

    await user.click(dieta('Vegetariano'));

    expect(pressed(dieta('Vegetariano'))).toBe(true);
  });

  test('Vegano adds, and locks, the allergens it implies: huevo, pescado and sulfitos', async () => {
    const user = setupUser();
    renderForm();

    await user.click(dieta('Vegano'));

    for (const label of ['Huevo', 'Pescado', 'Sulfitos']) {
      expect(pressed(alergeno(label))).toBe(true);
      expect(locked(alergeno(label))).toBe(true);
    }
    expect(pressed(alergeno('Soja'))).toBe(false);
    expect(locked(alergeno('Soja'))).toBe(false);
  });

  test('Vegetariano adds pescado and sulfitos but, on real catalogue data, not huevo', async () => {
    const user = setupUser();
    renderForm();

    await user.click(dieta('Vegetariano'));

    expect(pressed(alergeno('Pescado'))).toBe(true);
    expect(pressed(alergeno('Sulfitos'))).toBe(true);
    expect(pressed(alergeno('Huevo'))).toBe(false);
  });

  test('Sin gluten adds and locks the gluten allergen', async () => {
    const user = setupUser();
    renderForm();

    await user.click(dieta('Sin gluten'));

    expect(pressed(alergeno('Gluten'))).toBe(true);
    expect(locked(alergeno('Gluten'))).toBe(true);
  });

  test('a locked allergen cannot be removed by clicking it', async () => {
    const user = setupUser();
    renderForm();
    await user.click(dieta('Sin gluten'));

    await user.click(alergeno('Gluten'));

    expect(pressed(alergeno('Gluten'))).toBe(true);
  });

  test('switching Vegano off never removes an allergen it had added (add-only), and releases the ones no diet still implies', async () => {
    const user = setupUser();
    renderForm();
    await user.click(dieta('Vegano'));

    await user.click(dieta('Vegano'));

    expect(pressed(dieta('Vegano'))).toBe(false);
    // Vegetariano stays on, so pescado and sulfitos stay locked; huevo is no longer implied by anything.
    expect(pressed(alergeno('Huevo'))).toBe(true);
    expect(locked(alergeno('Huevo'))).toBe(false);
    expect(locked(alergeno('Pescado'))).toBe(true);
  });

  test('a free allergen toggles on and off', async () => {
    const user = setupUser();
    renderForm();

    await user.click(alergeno('Soja'));
    expect(pressed(alergeno('Soja'))).toBe(true);

    await user.click(alergeno('Soja'));
    expect(pressed(alergeno('Soja'))).toBe(false);
  });
});

describe('PreferencesForm — saving', () => {
  test('the save button starts disabled and follows the changes: off again when the change is undone', async () => {
    const user = setupUser();
    renderForm();
    expect(saveButton().disabled).toBe(true);

    await user.click(alergeno('Soja'));
    expect(saveButton().disabled).toBe(false);

    await user.click(alergeno('Soja'));
    expect(saveButton().disabled).toBe(true);
  });

  test('editing the meal planning grid also makes the form saveable', async () => {
    const user = setupUser();
    renderForm();

    await user.click(screen.getAllByText('Ninguno')[0]);

    expect(saveButton().disabled).toBe(false);
  });

  test('saving sends the edited diet and allergens together with the onboarding fields the form does not show', async () => {
    const user = setupUser();
    renderForm();
    await user.click(dieta('Sin lactosa'));
    await user.click(alergeno('Soja'));

    await user.click(saveButton());

    await waitFor(() => expect(upsert).toHaveBeenCalledTimes(1));
    expect(upsert.mock.calls[0][0]).toMatchObject({
      dieta_sin_lactosa: true,
      alergenos: ['soja'],
      num_personas: 3,
      adultos: 2,
      ninos: 1,
      ingredientes_odiados: ['cebolla'],
      cocinas_favoritas: ['española'],
    });
  });

  test('a successful save says so, and editing again takes the message away', async () => {
    const user = setupUser();
    renderForm();
    await user.click(alergeno('Soja'));

    await user.click(saveButton());

    expect((await screen.findByTestId('preferencias_saved_message')).textContent).toBe('Preferencias guardadas.');

    await user.click(alergeno('Apio'));
    expect(screen.queryByTestId('preferencias_saved_message')).toBeNull();
  });

  test('while saving the button reads Guardando… and cannot be pressed twice', async () => {
    let finish: () => void = () => {};
    upsert.mockImplementation(async () => new Promise<never>((resolve) => { finish = () => resolve(undefined as never); }));
    const user = setupUser();
    renderForm();
    await user.click(alergeno('Soja'));

    await user.click(saveButton());

    await waitFor(() => expect(saveButton().textContent).toBe('Guardando…'));
    expect(saveButton().disabled).toBe(true);
    finish();
    await waitFor(() => expect(saveButton().textContent).toBe('Actualizar Preferencias'));
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  test('a failed save shows an error, logs the cause, and does not claim it was saved', async () => {
    upsert.mockRejectedValue(new Error('rls'));
    const user = setupUser();
    renderForm();
    await user.click(alergeno('Soja'));

    await user.click(saveButton());

    expect((await screen.findByTestId('preferencias_save_error_message')).textContent).toBe('No se pudieron guardar tus preferencias. Inténtalo de nuevo.');
    expect(screen.queryByTestId('preferencias_saved_message')).toBeNull();
    expect(consoleError).toHaveBeenCalled();
    expect(saveButton().disabled).toBe(false);
  });

  test('a retry after a failed save clears the error', async () => {
    upsert.mockRejectedValueOnce(new Error('rls'));
    const user = setupUser();
    renderForm();
    await user.click(alergeno('Soja'));
    await user.click(saveButton());
    await screen.findByText('No se pudieron guardar tus preferencias. Inténtalo de nuevo.');

    await user.click(saveButton());

    await waitFor(() => expect(screen.queryByText('No se pudieron guardar tus preferencias. Inténtalo de nuevo.')).toBeNull());
    expect(await screen.findByTestId('preferencias_saved_message')).not.toBeNull();
  });
});
