import type { ShoppingListPersistido } from '@/lib/api/shopping-list';
import type { ShoppingListSuggestion } from '@/lib/api/types';
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import * as edgeFunctions from '@/lib/api/edge-functions';
import * as authApi from '@/lib/client-api/auth';
import * as shoppingApi from '@/lib/client-api/shopping-list';
import { act, renderHook, waitFor } from '@/tests/component-render';
import { useShoppingList } from './use-shopping-list';

// FRESCO-1076 — the suggestion add / remove paths and the offline queue of the
// shopping-list hook. The view tests cover ticking; these cover what they do not:
// every action reverts and says so when the server refuses it.

const LIST: ShoppingListPersistido = {
  id: 'list1',
  mealPlanId: 'plan1',
  desactualizada: false,
  pasillos: [
    { nombre: 'Frutas', orden: 1, items: [{ nombre: 'Tomate', cantidad: 2, unidad: 'unidades', comprado: false }] },
  ],
  resumen: { total_items: 1, coste_estimado_min: 0, coste_estimado_max: 0, moneda: 'EUR' },
};

const SUGERENCIA: ShoppingListSuggestion = { nombre: 'Aceite', pasillo: 'Despensa', cantidad: 1, unidad: 'l', precio_estimado: 5 };

const onToggleFailure = mock((_t: { pasilloIdx: number, itemIdx: number }) => {});

let suggestionsSpy: ReturnType<typeof spyOn<typeof edgeFunctions, 'getShoppingListSuggestions'>>;
let tokenSpy: ReturnType<typeof spyOn<typeof authApi, 'getAccessToken'>>;
let addSpy: ReturnType<typeof spyOn<typeof shoppingApi, 'addShoppingListItem'>>;
let removeSpy: ReturnType<typeof spyOn<typeof shoppingApi, 'removeShoppingListItem'>>;
let toggleSpy: ReturnType<typeof spyOn<typeof shoppingApi, 'toggleShoppingListItem'>>;
let clearSpy: ReturnType<typeof spyOn<typeof shoppingApi, 'clearComprados'>>;
let errorSpy: ReturnType<typeof spyOn<typeof console, 'error'>>;

beforeEach(() => {
  onToggleFailure.mockClear();
  tokenSpy = spyOn(authApi, 'getAccessToken').mockResolvedValue('token');
  suggestionsSpy = spyOn(edgeFunctions, 'getShoppingListSuggestions').mockResolvedValue({ suggestions: [SUGERENCIA] });
  addSpy = spyOn(shoppingApi, 'addShoppingListItem').mockResolvedValue(undefined);
  removeSpy = spyOn(shoppingApi, 'removeShoppingListItem').mockResolvedValue(undefined);
  toggleSpy = spyOn(shoppingApi, 'toggleShoppingListItem').mockResolvedValue(undefined);
  clearSpy = spyOn(shoppingApi, 'clearComprados').mockResolvedValue(undefined);
  errorSpy = spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  for (const spy of [tokenSpy, suggestionsSpy, addSpy, removeSpy, toggleSpy, clearSpy, errorSpy]) { spy.mockRestore(); }
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
});

async function setup() {
  const view = renderHook(() => useShoppingList({ list: LIST, onToggleFailure }));
  await waitFor(() => expect(view.result.current.suggestions).toHaveLength(1));
  return view;
}

describe('useShoppingList suggestions', () => {
  test('a failed suggestions load shows none and no error over the list', async () => {
    suggestionsSpy.mockRejectedValue(new Error('edge down'));
    const view = renderHook(() => useShoppingList({ list: LIST, onToggleFailure }));
    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    expect(view.result.current.suggestions).toEqual([]);
    expect(view.result.current.errorMessage).toBeNull();
  });

  test('adding a suggestion moves it from the carousel into a new aisle and saves it', async () => {
    const view = await setup();
    await act(async () => view.result.current.handleAddSuggestion(SUGERENCIA));
    expect(view.result.current.suggestions).toEqual([]);
    const despensa = view.result.current.pasillos.find(p => p.nombre === 'Despensa');
    expect(despensa?.items[0]).toMatchObject({ nombre: 'Aceite', origen: 'sugerencia', comprado: false });
    expect(addSpy).toHaveBeenCalledWith({ listId: 'list1', pasilloNombre: 'Despensa', item: expect.objectContaining({ nombre: 'Aceite' }) });
  });

  test('a refused add puts the card back, drops the item and says so', async () => {
    addSpy.mockRejectedValue(new Error('refused'));
    const view = await setup();
    await act(async () => view.result.current.handleAddSuggestion(SUGERENCIA));
    expect(view.result.current.pasillos.some(p => p.nombre === 'Despensa')).toBe(false);
    expect(view.result.current.suggestions).toEqual([SUGERENCIA]);
    expect(view.result.current.errorMessage).toBe('No se pudo añadir el producto. Vuelve a intentarlo.');
  });

  test('removing an added suggestion takes it off the list and puts its card back', async () => {
    const view = await setup();
    await act(async () => view.result.current.handleAddSuggestion(SUGERENCIA));
    await act(async () => view.result.current.handleRemoveSuggestion({ pasilloNombre: 'Despensa', itemNombre: 'Aceite' }));
    expect(view.result.current.pasillos.some(p => p.nombre === 'Despensa')).toBe(false);
    expect(view.result.current.suggestions.map(s => s.nombre)).toEqual(['Aceite']);
    expect(removeSpy).toHaveBeenCalledWith({ listId: 'list1', pasilloNombre: 'Despensa', itemNombre: 'Aceite' });
  });

  test('a refused remove brings the item back and says so', async () => {
    const view = await setup();
    await act(async () => view.result.current.handleAddSuggestion(SUGERENCIA));
    removeSpy.mockRejectedValue(new Error('refused'));
    await act(async () => view.result.current.handleRemoveSuggestion({ pasilloNombre: 'Despensa', itemNombre: 'Aceite' }));
    expect(view.result.current.pasillos.find(p => p.nombre === 'Despensa')?.items).toHaveLength(1);
    expect(view.result.current.errorMessage).toBe('No se pudo quitar el producto. Vuelve a intentarlo.');
  });

  test('removing something that is not an added suggestion does nothing, not even a request', async () => {
    const view = await setup();
    await act(async () => view.result.current.handleRemoveSuggestion({ pasilloNombre: 'Frutas', itemNombre: 'Tomate' }));
    expect(removeSpy).not.toHaveBeenCalled();
    expect(view.result.current.pasillos[0]?.items).toHaveLength(1);
  });
});

describe('useShoppingList clearing and the offline queue', () => {
  test('a refused "compra realizada" restores the bought items and says so', async () => {
    clearSpy.mockRejectedValue(new Error('refused'));
    const view = await setup();
    await act(async () => view.result.current.handleToggle({ pasilloIdx: 0, itemIdx: 0, nextComprado: true }));
    await act(async () => view.result.current.removeComprados());
    expect(view.result.current.pasillos[0]?.items[0]?.comprado).toBe(true);
    expect(view.result.current.errorMessage).toBe('No se pudieron quitar los productos comprados. Vuelve a intentarlo.');
  });

  test('a tick queued offline that still fails when the connection returns stays queued and logs', async () => {
    const view = await setup();
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    toggleSpy.mockRejectedValue(new Error('Failed to fetch'));
    await act(async () => view.result.current.handleToggle({ pasilloIdx: 0, itemIdx: 0, nextComprado: true }));
    expect(view.result.current.pasillos[0]?.items[0]?.comprado).toBe(true);
    expect(view.result.current.errorMessage).toContain('Sin conexión');

    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('[ShoppingListView] queued toggle still failing, kept for later', expect.any(Error)));
    expect(view.result.current.errorMessage).toContain('Sin conexión');
  });

  test('a queued tick sent after reconnecting clears the offline notice', async () => {
    const view = await setup();
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    toggleSpy.mockRejectedValueOnce(new Error('Failed to fetch'));
    await act(async () => view.result.current.handleToggle({ pasilloIdx: 0, itemIdx: 0, nextComprado: true }));

    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(view.result.current.errorMessage).toBeNull());
    expect(toggleSpy).toHaveBeenLastCalledWith({ listId: 'list1', pasilloIdx: 0, itemIdx: 0, comprado: true });
  });
});
