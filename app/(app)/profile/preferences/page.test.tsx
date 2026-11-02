import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import * as profileLoader from '@/lib/profile/load-profile-page-data';
import { renderWithProviders, screen } from '@/tests/component-render';
import '@/tests/mocks/next-navigation';

// FRESCO-1079 — /profile/preferences: the diet, allergen and meal-planning form with a way back. The
// page only hands the form what the loader read: the saved preferences and whether the health-data
// consent is already given. The loader is the only thing replaced.

void mock.module('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) } }),
}));

const { default: PreferencesPage } = await import('./page');

const PREFERENCES = {
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
  alergenos: ['gluten'],
  ingredientes_odiados: [],
  cocinas_favoritas: [],
};

let loaderSpy: ReturnType<typeof spyOn<typeof profileLoader, 'loadPreferencesPageData'>>;

beforeEach(() => {
  loaderSpy = spyOn(profileLoader, 'loadPreferencesPageData').mockResolvedValue({ dietaryPreferences: PREFERENCES, hasHealthDataConsent: true });
});

afterEach(() => { loaderSpy.mockRestore(); });

const renderPage = async () => { renderWithProviders(await PreferencesPage()); };

describe('ProfilePreferencesPage', () => {
  test('shows the title and a way back to the profile', async () => {
    await renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Preferencias');
    expect(screen.getByTestId('preferences_back_link')).toHaveAttribute('href', '/profile');
  });

  test('loads the preferences of the signed-in user', async () => {
    await renderPage();
    expect(loaderSpy).toHaveBeenCalledWith(expect.anything(), 'user-1');
  });

  test('renders the form with what was saved', async () => {
    await renderPage();
    expect(screen.getByTestId('preferencesForm')).toBeInTheDocument();
  });
});
