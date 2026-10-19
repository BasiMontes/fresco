import type { ShoppingListPersistido } from '@/lib/api/shopping-list';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { act, renderWithProviders, screen, setupUser, waitFor } from '@/tests/component-render';
import '@/tests/mocks/next-navigation';

/**
 * FRESCO-1014 (A7-UI-10) — the shopping list in a shop with no signal. A tick that cannot reach the server
 * must not silently undo itself with a message nobody can see: offline it stays ticked, is queued and is sent
 * when the connection returns; a refusal from the server reverts it. Either way the person gets an alert.
 * `@/lib/supabase/client` is the only thing mocked, so the real `toggleShoppingListItem` runs.
 */

interface RpcCall { fn: string, args: Record<string, unknown> }
let rpcCalls: RpcCall[] = [];
let rpcFails = true;

void mock.module('@/lib/supabase/client', () => ({
  createClient: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return rpcFails ? { data: null, error: { message: 'Failed to fetch' } } : { data: null, error: null };
    },
    auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) },
  }),
}));

const { ShoppingListView } = await import('./shopping-list-view');

const LIST: ShoppingListPersistido = {
  id: 'list1',
  mealPlanId: 'plan-list1',
  desactualizada: false,
  pasillos: [
    {
      nombre: 'Frutas y verduras',
      orden: 1,
      items: [
        { nombre: 'Espinacas', cantidad: 200, unidad: 'g', comprado: false },
        { nombre: 'Tomate', cantidad: 2, unidad: 'unidades', comprado: false },
      ],
    },
  ],
  resumen: { total_items: 2, coste_estimado_min: 0, coste_estimado_max: 0, moneda: 'EUR' },
};

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
}

const realFetch = globalThis.fetch;

beforeEach(() => {
  rpcCalls = [];
  rpcFails = true;
  // The suggestions carousel fetches on mount; it is not the subject here.
  globalThis.fetch = (async () => new Response(JSON.stringify({ suggestions: [] }), { status: 200 })) as unknown as typeof fetch;
});

afterEach(() => {
  setOnline(true);
  globalThis.fetch = realFetch;
});

describe('ShoppingListView — ticks without signal (FRESCO-1014, A7-UI-10)', () => {
  test('offline, the tick stays and an alert says it will be saved when the signal returns', async () => {
    setOnline(false);
    const user = setupUser();
    renderWithProviders(<ShoppingListView list={LIST} />);

    await user.click(screen.getByRole('checkbox', { name: 'Espinacas' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Sin conexión');
    expect(alert).toHaveAttribute('data-testid', 'shopping_list_toggle_error_message');
    expect(screen.getByRole('checkbox', { name: 'Espinacas' })).toBeChecked();
  });

  test('when the connection returns, the queued tick is sent and the alert goes away', async () => {
    setOnline(false);
    const user = setupUser();
    renderWithProviders(<ShoppingListView list={LIST} />);
    await user.click(screen.getByRole('checkbox', { name: 'Tomate' }));
    await screen.findByRole('alert');
    rpcCalls = [];

    setOnline(true);
    rpcFails = false;
    act(() => { window.dispatchEvent(new Event('online')); });

    await waitFor(() => expect(rpcCalls).toHaveLength(1));
    expect(rpcCalls[0]).toEqual({ fn: 'jsonb_set_comprado', args: { p_list_id: 'list1', p_pasillo_idx: 0, p_item_idx: 1, p_comprado: true } });
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByRole('checkbox', { name: 'Tomate' })).toBeChecked();
  });

  test('an untick made offline replaces the tick for the same item: only the last state is sent', async () => {
    setOnline(false);
    const user = setupUser();
    renderWithProviders(<ShoppingListView list={LIST} />);
    await user.click(screen.getByRole('checkbox', { name: 'Espinacas' }));
    await user.click(screen.getByRole('checkbox', { name: 'Espinacas' }));
    rpcCalls = [];

    setOnline(true);
    rpcFails = false;
    act(() => { window.dispatchEvent(new Event('online')); });

    await waitFor(() => expect(rpcCalls).toHaveLength(1));
    expect(rpcCalls[0].args.p_comprado).toBe(false);
  });

  test('online, a refused tick is reverted and the person is told, in an alert', async () => {
    setOnline(true);
    const user = setupUser();
    renderWithProviders(<ShoppingListView list={LIST} />);

    await user.click(screen.getByRole('checkbox', { name: 'Espinacas' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar el cambio');
    expect(screen.getByRole('checkbox', { name: 'Espinacas' })).not.toBeChecked();
  });

  test('the alert is pinned to the viewport, not left in the page flow where a scrolled shopper misses it', async () => {
    setOnline(false);
    const user = setupUser();
    renderWithProviders(<ShoppingListView list={LIST} />);

    await user.click(screen.getByRole('checkbox', { name: 'Espinacas' }));

    expect((await screen.findByRole('alert')).className).toContain('fixed');
  });
});
