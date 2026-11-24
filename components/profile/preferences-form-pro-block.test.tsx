import type { OnboardingProfilePayload } from '@/lib/api/user-profile';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as clientApi from '@/lib/client-api/user-profile';
import { renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';
import { PreferencesForm } from './preferences-form';

/**
 * FRESCO-1282 — the goal, the cooking level and the favourite cuisines on `/profile/preferences`.
 * Pro edits them and the save carries them; Free sees what it saved at onboarding, read-only, with a
 * way to Pro and no control that could change them (the generator only uses them with Pro, ADR-0071).
 * `fetch` is never reached: the consent is already given and the save goes through the stubbed upsert.
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
  objetivo: 'comer_sano',
  nivel_experiencia: 'novato',
};

let upsert: ReturnType<typeof spyOn<typeof clientApi, 'upsertUserProfile'>>;

beforeEach(() => {
  upsert = spyOn(clientApi, 'upsertUserProfile').mockResolvedValue(undefined);
});

afterEach(() => {
  upsert.mockRestore();
});

function renderForm(isPro: boolean, initialPreferences: OnboardingProfilePayload = PREFERENCES) {
  return renderWithProviders(<PreferencesForm initialPreferences={initialPreferences} hasHealthDataConsent isPro={isPro} />);
}

const saveButton = () => screen.getByTestId<HTMLButtonElement>('actualizar_preferencias_button');
const text = (testId: string) => screen.getByTestId(testId).textContent;
// Plain booleans on purpose: a failing jest-dom matcher makes bun print the whole DOM, which can take minutes.
const pressed = (button: HTMLElement) => button.getAttribute('aria-pressed') === 'true';
const cocina = (label: string) => screen.getAllByTestId('preferencia_cocina_option').find(button => button.textContent?.trim() === label)!;
const radio = (group: string, value: string) => screen.getByTestId(`${group}_option_${value}`);

describe('PreferencesForm — Pro edits goal, level and cuisines', () => {
  test('shows the editable block and no locked one', () => {
    renderForm(true);

    expect(screen.getByTestId('preferencias_pro_bloque')).toBeInTheDocument();
    expect(screen.queryByTestId('preferencias_pro_bloqueado')).toBeNull();
  });

  test('starts with the saved values selected', () => {
    renderForm(true);

    expect(radio('preferencia_objetivo_group', 'comer_sano').getAttribute('aria-checked')).toBe('true');
    expect(radio('preferencia_nivel_group', 'novato').getAttribute('aria-checked')).toBe('true');
    expect(pressed(cocina('Española'))).toBe(true);
    expect(pressed(cocina('Italiana'))).toBe(false);
    expect(saveButton().disabled).toBe(true);
  });

  test('changing any of the three makes the form saveable, and undoing it turns the save off again', async () => {
    const user = setupUser();
    renderForm(true);

    await user.click(cocina('Italiana'));
    expect(saveButton().disabled).toBe(false);

    await user.click(cocina('Italiana'));
    expect(saveButton().disabled).toBe(true);

    await user.click(radio('preferencia_objetivo_group', 'ahorrar_dinero'));
    expect(saveButton().disabled).toBe(false);
  });

  test('saving sends the new goal, level and cuisines together with the rest of the profile', async () => {
    const user = setupUser();
    renderForm(true);
    await user.click(radio('preferencia_objetivo_group', 'ahorrar_dinero'));
    await user.click(radio('preferencia_nivel_group', 'chef'));
    await user.click(cocina('Italiana'));

    await user.click(saveButton());

    await waitFor(() => expect(upsert).toHaveBeenCalledTimes(1));
    const sent = upsert.mock.calls[0][0];
    expect(sent.objetivo).toBe('ahorrar_dinero');
    expect(sent.nivel_experiencia).toBe('chef');
    expect([...sent.cocinas_favoritas].sort()).toEqual(['española', 'italiana']);
    expect(sent.num_personas).toBe(3);
    expect(sent.ingredientes_odiados).toEqual(['cebolla']);
  });

  test('a Pro save that only changes the diet does not send the goal or the level either', async () => {
    const user = setupUser();
    renderForm(true);
    await user.click(screen.getAllByTestId('preferencia_dieta_option').find(button => button.textContent?.trim() === 'Keto')!);

    await user.click(saveButton());

    await waitFor(() => expect(upsert).toHaveBeenCalledTimes(1));
    const sent = upsert.mock.calls[0][0];
    expect('objetivo' in sent).toBe(false);
    expect('nivel_experiencia' in sent).toBe(false);
  });

  test('a user who never chose a goal or a level can save a cuisine without sending them', async () => {
    const user = setupUser();
    renderForm(true, { ...PREFERENCES, objetivo: undefined, nivel_experiencia: undefined });
    await user.click(cocina('Mexicana'));

    await user.click(saveButton());

    await waitFor(() => expect(upsert).toHaveBeenCalledTimes(1));
    const sent = upsert.mock.calls[0][0];
    expect(sent.objetivo).toBeUndefined();
    expect(sent.nivel_experiencia).toBeUndefined();
  });
});

describe('PreferencesForm — Free sees them locked', () => {
  test('shows the locked block with the saved values and no locked-out editable one', () => {
    renderForm(false);

    expect(screen.getByTestId('preferencias_pro_bloqueado')).toBeInTheDocument();
    expect(screen.queryByTestId('preferencias_pro_bloque')).toBeNull();
    expect(text('preferencia_objetivo_valor')).toBe('Comer sano');
    expect(text('preferencia_nivel_valor')).toBe('Novato');
    expect(text('preferencia_cocinas_valor')).toBe('Española');
  });

  test('has no control that could change them', () => {
    renderForm(false);

    expect(screen.queryByTestId('preferencia_objetivo_group')).toBeNull();
    expect(screen.queryByTestId('preferencia_nivel_group')).toBeNull();
    expect(screen.queryAllByTestId('preferencia_cocina_option')).toHaveLength(0);
  });

  test('says why and links to Pro', () => {
    renderForm(false);

    expect(text('preferencias_pro_aviso')).toContain('Con Pro');
    expect(screen.getByTestId('preferencias_pro_enlace').getAttribute('href')).toBe('/profile');
  });

  test('says "Sin indicar" for what was never chosen', () => {
    renderForm(false, { ...PREFERENCES, objetivo: undefined, nivel_experiencia: undefined, cocinas_favoritas: [] });

    expect(text('preferencia_objetivo_valor')).toBe('Sin indicar');
    expect(text('preferencia_nivel_valor')).toBe('Sin indicar');
    expect(text('preferencia_cocinas_valor')).toBe('Sin indicar');
  });

  test('saving a diet change does not send the goal or the level, so it cannot overwrite them', async () => {
    const user = setupUser();
    renderForm(false);
    await user.click(screen.getAllByTestId('preferencia_dieta_option').find(button => button.textContent?.trim() === 'Keto')!);

    await user.click(saveButton());

    await waitFor(() => expect(upsert).toHaveBeenCalledTimes(1));
    const sent = upsert.mock.calls[0][0];
    expect(sent).toMatchObject({ dieta_keto: true, cocinas_favoritas: ['española'] });
    expect('objetivo' in sent).toBe(false);
    expect('nivel_experiencia' in sent).toBe(false);
  });
});
