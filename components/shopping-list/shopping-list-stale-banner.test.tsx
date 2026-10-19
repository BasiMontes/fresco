import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';
import { routerMock } from '@/tests/mocks/next-navigation';

/**
 * FRESCO-1010 — the banner of a stale shopping list: it says the menu changed, and "Actualizar lista" asks
 * `generate-shopping-list` to rebuild THIS plan's list (refresh mode), then re-reads the page.
 */

void mock.module('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'token-1' } } }) } }),
}));

const { ShoppingListStaleBanner } = await import('./shopping-list-stale-banner');

let fetchSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  routerMock.refresh.mockClear();
  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ shopping_list_id: 'l1', pasillos: [], resumen: {} }), { status: 200 }));
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe('ShoppingListStaleBanner', () => {
  test('says the menu changed and keeps the person\'s marks', () => {
    renderWithProviders(<ShoppingListStaleBanner mealPlanId="plan-1" />);

    expect(screen.getByTestId('shopping_list_stale_banner')).toHaveTextContent('Tu menú ha cambiado');
    expect(screen.getByTestId('shopping_list_stale_banner')).toHaveTextContent('comprado');
  });

  test('"Actualizar lista" asks for a refresh of that plan and re-reads the page', async () => {
    const user = setupUser();
    renderWithProviders(<ShoppingListStaleBanner mealPlanId="plan-1" />);

    await user.click(screen.getByTestId('shopping_list_refresh_button'));

    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalledTimes(1));
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('generate-shopping-list');
    expect(JSON.parse(init.body as string)).toEqual({ meal_plan_id: 'plan-1', refresh: true });
  });

  test('a failed refresh says so, does not re-read the page and lets the person try again', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ error: 'boom' }), { status: 500 }));
    const original = console.error;
    console.error = () => {};
    try {
      const user = setupUser();
      renderWithProviders(<ShoppingListStaleBanner mealPlanId="plan-1" />);

      await user.click(screen.getByTestId('shopping_list_refresh_button'));

      expect(await screen.findByTestId('shopping_list_refresh_error_message')).toBeInTheDocument();
      expect(routerMock.refresh).not.toHaveBeenCalled();
      expect(screen.getByTestId('shopping_list_refresh_button')).toBeEnabled();
    }
    finally {
      console.error = original;
    }
  });
});
