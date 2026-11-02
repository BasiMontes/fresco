import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { CookieConsentProvider } from '@/components/legal/cookie-consent-context';
import * as proPrices from '@/lib/billing/pro-prices';
import * as profileLoader from '@/lib/profile/load-profile-page-data';
import { renderWithProviders, screen } from '@/tests/component-render';
import '@/tests/mocks/next-navigation';

// FRESCO-1079 — /profile wires the session, the profile loader and the Stripe prices into the
// cards. Pinned here: who is shown (guest or registered), which plan blocks appear, and that the
// Stripe price is only read for a Free user. The loader and the price read are the only things replaced.

let user: { id: string, email?: string, created_at?: string, is_anonymous?: boolean } | null;
void mock.module('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }),
}));

const { default: ProfilePage } = await import('./page');

type Data = Awaited<ReturnType<typeof profileLoader.loadProfilePageData>>;

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
  alergenos: [],
  ingredientes_odiados: [],
  cocinas_favoritas: [],
};

const makeData = (overrides: Partial<Data> = {}): Data => ({
  plan: 'free',
  paymentFailedAt: null,
  nombre: 'Laura',
  dietaryPreferences: PREFERENCES,
  pastWeeks: [],
  trialAvailable: true,
  ...overrides,
});

let loaderSpy: ReturnType<typeof spyOn<typeof profileLoader, 'loadProfilePageData'>>;
let pricesSpy: ReturnType<typeof spyOn<typeof proPrices, 'getProPrices'>>;

beforeEach(() => {
  user = { id: 'user-1', email: 'laura@fresco.app', created_at: '2026-03-05T10:00:00.000Z' };
  loaderSpy = spyOn(profileLoader, 'loadProfilePageData').mockResolvedValue(makeData());
  pricesSpy = spyOn(proPrices, 'getProPrices').mockResolvedValue(null);
});

afterEach(() => {
  loaderSpy.mockRestore();
  pricesSpy.mockRestore();
});

const renderPage = async () => {
  renderWithProviders(<CookieConsentProvider initialDecision="rejected">{await ProfilePage()}</CookieConsentProvider>);
};

describe('ProfilePage', () => {
  test('shows the title, who the user is and the three anchored sections', async () => {
    await renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Perfil');
    expect(screen.getByText('¡Hola, Laura!')).toBeInTheDocument();
    expect(screen.getByTestId('profile_identity_email')).toHaveTextContent('laura@fresco.app');
    expect(screen.getByTestId('profile_section_nav')).toBeInTheDocument();
    for (const id of ['preferencias', 'suscripcion', 'cuenta']) {
      expect(screen.getByTestId(`profile_section_${id}`)).toBeInTheDocument();
    }
  });

  test('loads the profile data for the signed-in user', async () => {
    await renderPage();
    expect(loaderSpy).toHaveBeenCalledWith(expect.anything(), 'user-1');
  });

  test('a Free user sees the upsell, and the prices are read only for them', async () => {
    await renderPage();
    expect(screen.getByTestId('pro_upsell_card')).toBeInTheDocument();
    expect(pricesSpy).toHaveBeenCalledTimes(1);
  });

  test('a Pro user sees the subscription card and never pays for the Stripe read', async () => {
    loaderSpy.mockResolvedValue(makeData({ plan: 'pro' }));
    await renderPage();
    expect(screen.getByTestId('manage_subscription_button')).toBeInTheDocument();
    expect(screen.queryByTestId('pro_upsell_card')).toBeNull();
    expect(pricesSpy).not.toHaveBeenCalled();
  });

  test('a guest sees the Invitada badge and no email', async () => {
    user = { id: 'guest-1', is_anonymous: true };
    await renderPage();
    expect(screen.getByTestId('profile_identity_guest_tag')).toBeInTheDocument();
    expect(screen.queryByTestId('profile_identity_email')).toBeNull();
  });

  test('shows the menu history card', async () => {
    await renderPage();
    expect(screen.getByTestId('menu_history_card_empty')).toBeInTheDocument();
  });
});
