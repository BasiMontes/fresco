import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import * as favoritesApi from '@/lib/api/favorites';
import * as recipesApi from '@/lib/api/recipes';
import * as userProfileApi from '@/lib/api/user-profile';
import { makeFixtureRecipes } from '@/lib/fixtures/recipe';
import { renderWithProviders, screen } from '@/tests/component-render';
import '@/tests/mocks/next-navigation';

// FRESCO-1078 — /notifications. A real alert (payment failed) comes first, the
// curated notices follow, and a failing read hides its notice instead of breaking
// the page. Only the Supabase client and the data reads are replaced.

void mock.module('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) } }),
}));

const { default: NotificationsPage } = await import('./page');

let planSpy: ReturnType<typeof spyOn<typeof userProfileApi, 'getUserPlan'>>;
let failedAtSpy: ReturnType<typeof spyOn<typeof userProfileApi, 'getPaymentFailedAt'>>;
let welcomeSpy: ReturnType<typeof spyOn<typeof userProfileApi, 'getShouldShowWelcomeNotice'>>;
let routesSpy: ReturnType<typeof spyOn<typeof userProfileApi, 'getShouldShowRoutesNotice'>>;
let seenSpy: ReturnType<typeof spyOn<typeof userProfileApi, 'markWelcomeNoticeSeen'>>;
let latestSpy: ReturnType<typeof spyOn<typeof recipesApi, 'getLatestAvailableRecipes'>>;
let favoritesSpy: ReturnType<typeof spyOn<typeof favoritesApi, 'getFavoriteRecipeIds'>>;
let errorSpy: ReturnType<typeof spyOn<typeof console, 'error'>>;

beforeEach(() => {
  planSpy = spyOn(userProfileApi, 'getUserPlan').mockResolvedValue('free');
  failedAtSpy = spyOn(userProfileApi, 'getPaymentFailedAt').mockResolvedValue(null);
  welcomeSpy = spyOn(userProfileApi, 'getShouldShowWelcomeNotice').mockResolvedValue(false);
  routesSpy = spyOn(userProfileApi, 'getShouldShowRoutesNotice').mockResolvedValue(false);
  seenSpy = spyOn(userProfileApi, 'markWelcomeNoticeSeen').mockResolvedValue(undefined);
  latestSpy = spyOn(recipesApi, 'getLatestAvailableRecipes').mockResolvedValue([]);
  favoritesSpy = spyOn(favoritesApi, 'getFavoriteRecipeIds').mockResolvedValue(new Set<string>());
  errorSpy = spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  for (const spy of [planSpy, failedAtSpy, welcomeSpy, routesSpy, seenSpy, latestSpy, favoritesSpy, errorSpy]) { spy.mockRestore(); }
});

async function renderPage() {
  renderWithProviders(await NotificationsPage());
}

describe('NotificationsPage', () => {
  test('with nothing to say it shows the empty state', async () => {
    await renderPage();
    expect(screen.getByTestId('notifications_empty_state')).toHaveTextContent('Sin notificaciones');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Centro de Avisos');
    expect(screen.getByTestId('notifications_back_link')).toHaveAttribute('href', '/menu');
  });

  test('the welcome card shows once and is marked as seen for this user', async () => {
    welcomeSpy.mockResolvedValue(true);
    await renderPage();
    expect(screen.getByTestId('notifications_welcome_card')).toBeInTheDocument();
    expect(seenSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('notifications_empty_state')).toBeNull();
  });

  test('when marking the welcome as seen fails, the card still shows', async () => {
    welcomeSpy.mockResolvedValue(true);
    seenSpy.mockRejectedValue(new Error('db down'));
    await renderPage();
    expect(screen.getByTestId('notifications_welcome_card')).toBeInTheDocument();
  });

  test('no welcome means nothing is marked as seen', async () => {
    await renderPage();
    expect(seenSpy).not.toHaveBeenCalled();
  });

  test('the routes notice shows when it is due', async () => {
    routesSpy.mockResolvedValue(true);
    await renderPage();
    expect(screen.getByTestId('notifications_routes_notice')).toBeInTheDocument();
    expect(screen.queryByTestId('notifications_empty_state')).toBeNull();
  });

  test('recommended recipes show and replace the empty state, asking for at most 3', async () => {
    latestSpy.mockResolvedValue(makeFixtureRecipes(3));
    await renderPage();
    expect(screen.getByTestId('notifications_recommended_recipes_notice')).toBeInTheDocument();
    expect(screen.queryByTestId('notifications_empty_state')).toBeNull();
    expect(latestSpy.mock.calls[0]?.[1]).toMatchObject({ userId: 'user-1', limit: 3 });
  });

  test('a Pro user with a failed payment sees the payment alert', async () => {
    planSpy.mockResolvedValue('pro');
    failedAtSpy.mockResolvedValue('2026-11-01T10:00:00.000Z');
    await renderPage();
    expect(screen.getByTestId('notifications_payment_failed_notice')).toBeInTheDocument();
    expect(screen.queryByTestId('notifications_empty_state')).toBeNull();
  });

  test('a free user never sees the payment alert, even with a failed date on record', async () => {
    failedAtSpy.mockResolvedValue('2026-11-01T10:00:00.000Z');
    await renderPage();
    expect(screen.queryByTestId('notifications_payment_failed_notice')).toBeNull();
  });

  test('every failing read falls back to hiding its notice, and the page still renders', async () => {
    const boom = new Error('read failed');
    planSpy.mockRejectedValue(boom);
    failedAtSpy.mockRejectedValue(boom);
    welcomeSpy.mockRejectedValue(boom);
    routesSpy.mockRejectedValue(boom);
    latestSpy.mockRejectedValue(boom);
    favoritesSpy.mockRejectedValue(boom);
    await renderPage();
    expect(screen.getByTestId('notifications_empty_state')).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledTimes(6);
  });
});
