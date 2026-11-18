import type { ShoppingListPersistido } from '@/lib/api/shopping-list';
import { describe, expect, test } from 'bun:test';
import { CADENAS_ESTIMADAS } from '@/lib/grocery/estimacion-cadenas';
import { MERCADONA_CATALOG_FECHA } from '@/lib/grocery/mercadona-catalog.generated';
import { resolverCompra } from '@/lib/grocery/shopping-list-compra';
import { renderWithProviders, screen, within } from '@/tests/component-render';
import { ShoppingListComparison } from './shopping-list-comparison';
import { ShoppingListView } from './shopping-list-view';
import '@/tests/mocks/next-navigation';

/** FRESCO-1222 — the labelled chain estimate: every figure labelled, never worded as the chain's own price. */

const ESTIMADA = { cadena: 'dia', nombre: 'Dia', importe: 2.16, incluidos: 2, productos: 5 };
const REAL = { cadena: 'mercadona', nombre: 'Mercadona', importe: 7.5, incluidos: 4, productos: 5 };

describe('ShoppingListComparison', () => {
  test('every estimated figure carries the visible label and its product count', () => {
    renderWithProviders(<ShoppingListComparison reales={[REAL]} estimadas={CADENAS_ESTIMADAS.map(c => ({ ...ESTIMADA, cadena: c.id, nombre: c.nombre }))} />);

    for (const c of CADENAS_ESTIMADAS) {
      const fila = screen.getByTestId(`shopping_list_comparison_estimada_${c.id}`);
      expect(within(fila).getByText('Estimado, basado en Mercadona')).toBeVisible();
      expect(fila).toHaveTextContent('2 de 5 productos');
      expect(fila).toHaveTextContent('2,16€');
    }
  });

  test('there is exactly one label per estimated figure and none on the real rows', () => {
    renderWithProviders(<ShoppingListComparison reales={[REAL]} estimadas={[ESTIMADA]} />);

    expect(screen.getAllByText('Estimado, basado en Mercadona')).toHaveLength(1);
    expect(within(screen.getByTestId('shopping_list_comparison_real_mercadona')).queryByText(/estimado/i)).toBeNull();
    expect(screen.getByTestId('shopping_list_comparison_real_mercadona')).toHaveTextContent('4 de 5 productos');
  });

  test('an estimated chain is never worded as a price source', () => {
    renderWithProviders(<ShoppingListComparison reales={[REAL]} estimadas={[ESTIMADA]} />);

    expect(screen.queryByText(/precio de dia/i)).toBeNull();
    expect(screen.queryByText(/precios de dia/i)).toBeNull();
    expect(screen.queryByText(/precio real/i)).toBeNull();
  });

  test('renders nothing when there is nothing to compare', () => {
    renderWithProviders(<ShoppingListComparison reales={[]} estimadas={[]} />);

    expect(screen.queryByTestId('shopping_list_comparison')).toBeNull();
  });

  test('without estimates only the real chains show, with no estimated heading', () => {
    renderWithProviders(<ShoppingListComparison reales={[REAL]} estimadas={[]} />);

    expect(screen.getByTestId('shopping_list_comparison_real_mercadona')).toBeTruthy();
    expect(screen.queryByText('Estimado, basado en Mercadona')).toBeNull();
    expect(screen.queryByText(/otras cadenas/i)).toBeNull();
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
      expect(fila).toHaveTextContent('2 de 3 productos');
      expect(within(fila).getByText('Estimado, basado en Mercadona')).toBeTruthy();
    }
  });

  test('non-staples yield no estimate: only real data shows', () => {
    const list = listaCon([
      { nombre: 'aceite de oliva', cantidad: 50, unidad: 'ml', comprado: false },
      { nombre: 'garbanzos', cantidad: 400, unidad: 'g', comprado: false },
      { nombre: 'pasta', cantidad: 300, unidad: 'g', comprado: false },
    ]);
    renderWithProviders(<ShoppingListView list={list} compra={resolverCompra({ pasillos: list.pasillos, ahora: AHORA })} />);

    expect(screen.queryByText('Estimado, basado en Mercadona')).toBeNull();
    for (const c of CADENAS_ESTIMADAS) {
      expect(screen.queryByTestId(`shopping_list_comparison_estimada_${c.id}`)).toBeNull();
    }
    expect(screen.getByTestId('shopping_list_comparison_real_mercadona')).toBeTruthy();
  });

  test('a staple whose Mercadona price is hidden for age yields no estimate', () => {
    const list = listaCon([{ nombre: 'leche', cantidad: 500, unidad: 'ml', comprado: false }]);
    const tarde = new Date(AHORA.getTime() + 40 * 86_400_000);
    renderWithProviders(<ShoppingListView list={list} compra={resolverCompra({ pasillos: list.pasillos, ahora: tarde })} />);

    expect(screen.queryByText('Estimado, basado en Mercadona')).toBeNull();
  });
});
