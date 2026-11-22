import type { ShoppingListPersistido } from '@/lib/api/shopping-list';
import type { CompraPorItem } from '@/lib/grocery/compra';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as edgeFunctions from '@/lib/api/edge-functions';
import * as authApi from '@/lib/client-api/auth';
import { claveItemCompra } from '@/lib/grocery/compra';
import { CADENAS_ESTIMADAS } from '@/lib/grocery/estimacion-cadenas';
import { MERCADONA_CATALOG_FECHA } from '@/lib/grocery/mercadona-catalog.generated';
import { resolverCompra } from '@/lib/grocery/shopping-list-compra';
import { renderWithProviders, screen, within } from '@/tests/component-render';
import { ShoppingListComparison } from './shopping-list-comparison';
import { ShoppingListView } from './shopping-list-view';
import '@/tests/mocks/next-navigation';

// FRESCO-1219: the view asks for suggestions on mount; see shopping-list-view.test.tsx.
let suggestionsSpy: ReturnType<typeof spyOn<typeof edgeFunctions, 'getShoppingListSuggestions'>>;
let tokenSpy: ReturnType<typeof spyOn<typeof authApi, 'getAccessToken'>>;
beforeEach(() => {
  tokenSpy = spyOn(authApi, 'getAccessToken').mockResolvedValue('token');
  suggestionsSpy = spyOn(edgeFunctions, 'getShoppingListSuggestions').mockResolvedValue({ suggestions: [] });
});
afterEach(() => {
  tokenSpy.mockRestore();
  suggestionsSpy.mockRestore();
});

/** FRESCO-1222 — the labelled chain estimate: every figure labelled, never worded as the chain's own price. */

const ESTIMADA = { cadena: 'dia', nombre: 'Dia', importe: 2.16, incluidos: 2, productos: 5, basicos: ['leche', 'arroz'] };
const REAL = { cadena: 'mercadona', nombre: 'Mercadona', importe: 7.5, incluidos: 4, productos: 5 };
const ETIQUETA = 'Estimado, basado en Mercadona';

describe('ShoppingListComparison', () => {
  test('every estimated figure sits in a row that carries the visible label', () => {
    renderWithProviders(<ShoppingListComparison reales={[REAL]} estimadas={CADENAS_ESTIMADAS.map(c => ({ ...ESTIMADA, cadena: c.id, nombre: c.nombre }))} />);

    const filas = CADENAS_ESTIMADAS.map(c => screen.getByTestId(`shopping_list_comparison_estimada_${c.id}`));
    expect(filas).toHaveLength(5);
    for (const fila of filas) {
      expect(within(fila).getByText(ETIQUETA)).toBeVisible();
      expect(fila).toHaveTextContent('2,16€');
    }
    // No price figure in the estimate block lives outside a labelled row.
    const bloque = screen.getByTestId('shopping_list_comparison_estimadas');
    const cifras = within(bloque).getAllByText(/\d,\d{2}€/);
    expect(cifras).toHaveLength(filas.length);
    for (const cifra of cifras) {
      expect(cifra.closest('[data-testid^="shopping_list_comparison_estimada_"]')).not.toBeNull();
    }
  });

  test('the estimate is its own block: names the staples and the coverage, and says it is not comparable with the totals', () => {
    renderWithProviders(<ShoppingListComparison reales={[REAL]} estimadas={[ESTIMADA]} />);

    expect(screen.getByTestId('shopping_list_comparison_estimadas_alcance')).toHaveTextContent('leche y arroz, 2 de 5 productos');
    expect(screen.getByTestId('shopping_list_comparison_estimadas_aviso')).toHaveTextContent('no es comparable con los totales de arriba');
    // The real totals are a different block, with their own coverage and no estimate label.
    const real = screen.getByTestId('shopping_list_comparison_real_mercadona');
    expect(real).toHaveTextContent('4 de 5 productos');
    expect(within(real).queryByText(ETIQUETA)).toBeNull();
    expect(screen.getByTestId('shopping_list_comparison_estimadas').contains(real)).toBe(false);
  });

  test('there is exactly one label per estimated figure', () => {
    renderWithProviders(<ShoppingListComparison reales={[REAL]} estimadas={[ESTIMADA]} />);

    expect(screen.getAllByText(ETIQUETA)).toHaveLength(1);
  });

  test('renders nothing when there is nothing to compare', () => {
    renderWithProviders(<ShoppingListComparison reales={[]} estimadas={[]} />);

    expect(screen.queryByTestId('shopping_list_comparison')).toBeNull();
  });

  test('without estimates only the real chains show, with no estimate block', () => {
    renderWithProviders(<ShoppingListComparison reales={[REAL]} estimadas={[]} />);

    expect(screen.getByTestId('shopping_list_comparison_real_mercadona')).toBeTruthy();
    expect(screen.queryByTestId('shopping_list_comparison_estimadas')).toBeNull();
    expect(screen.queryByText(ETIQUETA)).toBeNull();
  });
});

describe('bundle boundary', () => {
  const RAIZ = new URL('../../', import.meta.url).pathname;

  test.each([
    'components/shopping-list/shopping-list-comparison.tsx',
    'components/shopping-list/shopping-list-view.tsx',
    'lib/grocery/estimacion-cadenas.ts',
  ])('%s imports no chain catalog and no server-only resolver', (archivo) => {
    const importaciones = [...readFileSync(`${RAIZ}${archivo}`, 'utf8').matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)].map(m => m[1]);

    expect(importaciones.length).toBeGreaterThan(0);
    for (const origen of importaciones) {
      expect(origen).not.toMatch(/\.generated/);
      expect(origen).not.toMatch(/shopping-list-compra/);
    }
  });
});

describe('ShoppingListView — comparison card (FRESCO-1222)', () => {
  const AHORA = new Date(MERCADONA_CATALOG_FECHA);

  function listaCon(items: ShoppingListPersistido['pasillos'][number]['items']): ShoppingListPersistido {
    return {
      id: 'list-cmp',
      mealPlanId: 'plan-cmp',
      desactualizada: false,
      pasillos: [{ nombre: 'Despensa', orden: 1, items }],
      resumen: { total_items: items.length, coste_estimado_min: 1, coste_estimado_max: 2, moneda: 'EUR' },
    };
  }

  test('a list with staples shows the card, with every chain figure labelled', () => {
    const list = listaCon([
      { nombre: 'leche', cantidad: 500, unidad: 'ml', comprado: false },
      { nombre: 'arroz', cantidad: 250, unidad: 'g', comprado: false },
      { nombre: 'aceite de oliva', cantidad: 50, unidad: 'ml', comprado: false },
    ]);
    renderWithProviders(<ShoppingListView list={list} compra={resolverCompra({ pasillos: list.pasillos, ahora: AHORA })} />);

    const tarjeta = screen.getByTestId('shopping_list_comparison');
    expect(within(tarjeta).getByText('Comparar tu compra')).toBeTruthy();
    for (const c of CADENAS_ESTIMADAS) {
      const fila = within(tarjeta).getByTestId(`shopping_list_comparison_estimada_${c.id}`);
      expect(within(fila).getByText(ETIQUETA)).toBeTruthy();
    }
    expect(within(tarjeta).getByTestId('shopping_list_comparison_estimadas_alcance')).toHaveTextContent('leche y arroz, 2 de 3 productos');
  });

  test('non-staples yield no estimate: only real data shows', () => {
    const list = listaCon([
      { nombre: 'aceite de oliva', cantidad: 50, unidad: 'ml', comprado: false },
      { nombre: 'atun', cantidad: 300, unidad: 'g', comprado: false },
      { nombre: 'tomate', cantidad: 400, unidad: 'g', comprado: false },
    ]);
    renderWithProviders(<ShoppingListView list={list} compra={resolverCompra({ pasillos: list.pasillos, ahora: AHORA })} />);

    expect(screen.queryByText(ETIQUETA)).toBeNull();
    for (const c of CADENAS_ESTIMADAS) {
      expect(screen.queryByTestId(`shopping_list_comparison_estimada_${c.id}`)).toBeNull();
    }
    expect(screen.getByTestId('shopping_list_comparison_real_mercadona')).toBeTruthy();
  });

  test('a staple whose Mercadona price is hidden for age yields no estimate', () => {
    const list = listaCon([{ nombre: 'leche', cantidad: 500, unidad: 'ml', comprado: false }]);
    const tarde = new Date(AHORA.getTime() + 40 * 86_400_000);
    renderWithProviders(<ShoppingListView list={list} compra={resolverCompra({ pasillos: list.pasillos, ahora: tarde })} />);

    expect(screen.queryByText(ETIQUETA)).toBeNull();
  });

  test('a no-date Mercadona price counts in neither the real totals nor the estimate', () => {
    const list = listaCon([{ nombre: 'leche', cantidad: 500, unidad: 'ml', comprado: false }]);
    const compra: CompraPorItem = {
      [claveItemCompra({ pasillo: 'Despensa', item: 'leche' })]: {
        precio: 0.96,
        precioEnlazado: 0.96,
        precioBaseEstimacion: undefined,
        enlaces: [{ cadena: 'mercadona', nombreCadena: 'Mercadona', url: 'https://example.test', antiguedadDias: null }],
      },
    };
    renderWithProviders(<ShoppingListView list={list} compra={compra} />);

    expect(screen.queryByTestId('shopping_list_comparison')).toBeNull();
  });
});
