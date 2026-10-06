import type { ShoppingListPersistido } from '@/lib/api/shopping-list';
import type { CompraPorItem } from '@/lib/grocery/compra';
import type { PerfilCompra } from '@/lib/grocery/product-compatibility';
import { describe, expect, test } from 'bun:test';
import { precioLinea } from '@/lib/grocery/line-price';
import { resolverCompra } from '@/lib/grocery/shopping-list-compra';
import { formatPrecio } from '@/lib/utils';
import { fireEvent, renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { ShoppingListView } from './shopping-list-view';

/**
 * FRESCO-426-ish (receipt ticket) — "Compra realizada" opens the receipt
 * ticket instead of immediately acting on the checked items; only once the
 * ticket is dismissed does `handleReceiptClose` remove them (via the
 * `jsonb_clear_comprados` RPC, `clearComprados()` — replaced the earlier
 * un-check-only placeholder once real usage showed that read as a no-op).
 * These tests pin the sequencing at the UI-observable level only — same
 * boundary `delete-week-button.test.tsx` draws (see its own comment,
 * ADR-0024 §11): no `@/lib/api/*` module mock (a bun re-transpile cliff per
 * that file's note), so the actual `clearComprados` network round-trip is
 * left untested here, deferred to e2e.
 */

/** What the page does on the server: resolve prices and links, then hand them to the view. */
function compraDe(list: ShoppingListPersistido, perfil?: PerfilCompra): CompraPorItem {
  return resolverCompra({ pasillos: list.pasillos, perfil });
}

const LIST: ShoppingListPersistido = {
  id: 'list1',
  pasillos: [
    {
      nombre: 'Frutas y verduras',
      orden: 1,
      items: [
        { nombre: 'Tomate', cantidad: 2, unidad: 'unidades', comprado: true },
        { nombre: 'Lechuga', cantidad: 1, unidad: 'unidades', comprado: false },
      ],
    },
  ],
  resumen: { total_items: 2, coste_estimado_min: 0, coste_estimado_max: 0, moneda: 'EUR' },
};

describe('ShoppingListView — item checkbox accessible name (FRESCO-498)', () => {
  test('each item checkbox exposes its item name as the accessible name', () => {
    renderWithProviders(<ShoppingListView list={LIST} />);

    // axe-core's `label` rule flagged these (~40 nodes in the live page, one
    // per rendered item) as inputs with no accessible name at all. The fix
    // wires `aria-labelledby` on the `Checkbox` to the `id` on the visible
    // item-name span instead of duplicating the text into a new hidden
    // label — asserting via `getByRole('checkbox', { name })` is exactly
    // what axe checks: the input's computed accessible name.
    expect(screen.getByRole('checkbox', { name: 'Tomate' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Lechuga' })).not.toBeChecked();
  });
});

describe('ShoppingListView — supermarket links per item (FRESCO-521)', () => {
  const LIST_WITH_LINKS: ShoppingListPersistido = {
    id: 'list2',
    pasillos: [
      {
        nombre: 'Frutas y verduras',
        orden: 1,
        items: [
          // Real dictionary entries: "aceite de oliva" only has a Mercadona
          // match, "alubias rojas" only has a Consum match (FRESCO-520
          // priority — a Consum URL is only ever populated when there's no
          // Mercadona one), "aguacate" has neither.
          { nombre: 'aceite de oliva', cantidad: 50, unidad: 'ml', comprado: false },
          { nombre: 'alubias rojas', cantidad: 300, unidad: 'g', comprado: false },
          { nombre: 'aguacate', cantidad: 1, unidad: 'unidades', comprado: false },
        ],
      },
    ],
    resumen: { total_items: 3, coste_estimado_min: 0, coste_estimado_max: 0, moneda: 'EUR' },
  };

  test('an item matched only in Mercadona shows the Mercadona link, not Consum (regression)', () => {
    renderWithProviders(<ShoppingListView list={LIST_WITH_LINKS} compra={compraDe(LIST_WITH_LINKS)} />);

    expect(screen.getByTestId('shopping_list_item_0_0_mercadona_link')).toBeTruthy();
    expect(screen.queryByTestId('shopping_list_item_0_0_consum_link')).toBeNull();
  });

  test('an item matched only in Consum shows the Consum link, not Mercadona', () => {
    renderWithProviders(<ShoppingListView list={LIST_WITH_LINKS} compra={compraDe(LIST_WITH_LINKS)} />);

    expect(screen.getByTestId('shopping_list_item_0_1_consum_link')).toBeTruthy();
    expect(screen.queryByTestId('shopping_list_item_0_1_mercadona_link')).toBeNull();
  });

  test('an item with no catalog match shows no supermarket link', () => {
    renderWithProviders(<ShoppingListView list={LIST_WITH_LINKS} compra={compraDe(LIST_WITH_LINKS)} />);

    expect(screen.queryByTestId('shopping_list_item_0_2_mercadona_link')).toBeNull();
    expect(screen.queryByTestId('shopping_list_item_0_2_consum_link')).toBeNull();
  });

  test('a bought item shows no supermarket link even with a real match', () => {
    const boughtList: ShoppingListPersistido = {
      ...LIST_WITH_LINKS,
      pasillos: [{
        ...LIST_WITH_LINKS.pasillos[0],
        items: LIST_WITH_LINKS.pasillos[0].items.map(item => ({ ...item, comprado: true })),
      }],
    };
    renderWithProviders(<ShoppingListView list={boughtList} compra={compraDe(boughtList)} />);

    expect(screen.queryByTestId('shopping_list_item_0_0_mercadona_link')).toBeNull();
    expect(screen.queryByTestId('shopping_list_item_0_1_consum_link')).toBeNull();
  });
});

describe('ShoppingListView — receipt ticket on "Compra realizada"', () => {
  test('the button is absent when nothing is checked', () => {
    const noneChecked: ShoppingListPersistido = {
      ...LIST,
      pasillos: [{ ...LIST.pasillos[0], items: [{ ...LIST.pasillos[0].items[0], comprado: false }] }],
    };
    renderWithProviders(<ShoppingListView list={noneChecked} />);

    expect(screen.queryByTestId('shopping_list_clear_comprados_button')).toBeNull();
  });

  test('clicking it opens the ticket with the checked items, without un-checking them yet', async () => {
    const user = setupUser();
    renderWithProviders(<ShoppingListView list={LIST} />);

    await user.click(screen.getByTestId('shopping_list_clear_comprados_button'));

    const paper = screen.getByTestId('receipt_ticket_paper');
    expect(paper).toHaveTextContent('Tomate');
    // Still in the list, still checked — `handleReceiptClose` hasn't run yet.
    expect(screen.getByTestId('shopping_list_item_0_0')).toBeChecked();
  });

  test('closing the ticket (Listo) starts it closing', async () => {
    // Doesn't assert the checkbox un-checks — that depends on
    // `toggleShoppingListItem`'s real network round-trip (same
    // `@/lib/api/*` boundary `delete-week-button.test.tsx` leaves to e2e,
    // per its own comment), not something this test controls.
    const user = setupUser();
    renderWithProviders(<ShoppingListView list={LIST} />);

    await user.click(screen.getByTestId('shopping_list_clear_comprados_button'));
    fireEvent.animationEnd(screen.getByTestId('receipt_ticket_paper'));
    await user.click(screen.getByTestId('receipt_ticket_done_button'));

    expect(screen.getByTestId('receipt_ticket_dialog')).toHaveClass('is-closing');
  });
});

describe('ShoppingListView — one price source for lines and total (FRESCO-827)', () => {
  const ITEMS = [
    // Stored estimate is the pre-fix 0 on purpose: the row must ignore it
    // when a catalog product is linked.
    { nombre: 'leche', cantidad: 1, unidad: 'l', comprado: false, precio_estimado: 0 },
    { nombre: 'aceite de oliva', cantidad: 50, unidad: 'ml', comprado: false, precio_estimado: 0.45 },
  ];
  const LIST_PRICES: ShoppingListPersistido = {
    id: 'list3',
    pasillos: [{ nombre: 'Lácteos y huevos', orden: 1, items: ITEMS }],
    // Stale Edge Function snapshot, deliberately different from the lines.
    resumen: { total_items: 2, coste_estimado_min: 99, coste_estimado_max: 99, moneda: 'EUR' },
  };

  test('each row shows the linked product price, never the stored 0,00', () => {
    renderWithProviders(<ShoppingListView list={LIST_PRICES} compra={compraDe(LIST_PRICES)} />);

    for (const item of ITEMS) {
      const esperado = formatPrecio(precioLinea(item) as number);
      expect(screen.getByText(new RegExp(`${esperado}$`.replace('.', '\\.')), { exact: false })).toBeTruthy();
    }
    expect(screen.queryByText(/0,00€/)).toBeNull();
  });

  test('the summary shows the weekly cost it is given, not the stored snapshot', () => {
    renderWithProviders(<ShoppingListView list={LIST_PRICES} compra={compraDe(LIST_PRICES)} costeMenu={42.5} />);

    expect(screen.getByText('42,50€')).toBeTruthy();
    expect(screen.queryByText(/99,00€/)).toBeNull();
  });

  test('falls back to the stored range when no weekly cost could be computed', () => {
    renderWithProviders(<ShoppingListView list={LIST_PRICES} compra={compraDe(LIST_PRICES)} />);

    expect(screen.getByText(/99,00–99,00€/)).toBeTruthy();
  });
});

describe('ShoppingListView — diet-compatible supermarket links (FRESCO-826)', () => {
  const LIST_CALDO: ShoppingListPersistido = {
    id: 'list4',
    pasillos: [{
      nombre: 'Conservas y salsas',
      orden: 1,
      items: [
        // Mercadona links "caldo pollo hacendado brick" for this ingredient.
        { nombre: 'caldo', cantidad: 500, unidad: 'ml', comprado: false, precio_estimado: 1.5 },
      ],
    }],
    resumen: { total_items: 1, coste_estimado_min: 0, coste_estimado_max: 0, moneda: 'EUR' },
  };

  test('without a profile the chicken stock keeps its supermarket link (baseline)', () => {
    renderWithProviders(<ShoppingListView list={LIST_CALDO} compra={compraDe(LIST_CALDO)} />);

    expect(screen.getByTestId('shopping_list_item_0_0_mercadona_link')).toBeTruthy();
  });

  test('a vegan profile shows no link for the chicken stock and falls back to the stored estimate', () => {
    renderWithProviders(<ShoppingListView list={LIST_CALDO} compra={compraDe(LIST_CALDO, { vegano: true })} />);

    expect(screen.queryByTestId('shopping_list_item_0_0_mercadona_link')).toBeNull();
    expect(screen.queryByTestId('shopping_list_item_0_0_consum_link')).toBeNull();
    expect(screen.getByText(/1,50€/)).toBeTruthy();
  });
});

describe('ShoppingListView — chain-agnostic links and data age (FRESCO-808)', () => {
  const LIST_FALSA: ShoppingListPersistido = {
    id: 'list5',
    pasillos: [{
      nombre: 'Pasta, arroz y legumbres',
      orden: 1,
      items: [{ nombre: 'arroz', cantidad: 500, unidad: 'g', comprado: false, precio_estimado: 0.5 }],
    }],
    resumen: { total_items: 1, coste_estimado_min: 0, coste_estimado_max: 0, moneda: 'EUR' },
  };
  const claveArroz = 'Pasta, arroz y legumbres::arroz';
  const compraFalsa = (antiguedadDias: number | null): CompraPorItem => ({
    [claveArroz]: {
      precio: 1.2,
      enlaces: [{ cadena: 'cadenafalsa', nombreCadena: 'Cadena falsa', url: 'https://cadena.example/arroz', antiguedadDias }],
    },
  });

  test('a chain the component has never heard of gets a link named after it', () => {
    renderWithProviders(<ShoppingListView list={LIST_FALSA} compra={compraFalsa(null)} />);

    const enlace = screen.getByTestId('shopping_list_item_0_0_cadenafalsa_link');
    expect(enlace).toHaveAttribute('href', 'https://cadena.example/arroz');
    expect(enlace).toHaveAttribute('aria-label', 'Abrir Arroz en Cadena falsa');
  });

  test('shows how old the price is when the source says so', () => {
    renderWithProviders(<ShoppingListView list={LIST_FALSA} compra={compraFalsa(3)} />);

    expect(screen.getByTestId('shopping_list_item_0_0_precio_antiguedad')).toHaveTextContent('precio de hace 3 días');
  });

  test.each([[0, 'precio de hoy'], [1, 'precio de ayer']])('%i days old reads "%s"', (dias, texto) => {
    renderWithProviders(<ShoppingListView list={LIST_FALSA} compra={compraFalsa(dias)} />);

    expect(screen.getByTestId('shopping_list_item_0_0_precio_antiguedad')).toHaveTextContent(texto);
  });

  test('shows no age at all when the source gives no date', () => {
    renderWithProviders(<ShoppingListView list={LIST_FALSA} compra={compraFalsa(null)} />);

    expect(screen.queryByTestId('shopping_list_item_0_0_precio_antiguedad')).toBeNull();
  });

  test('without resolved purchase data a row shows its stored estimate and no link', () => {
    renderWithProviders(<ShoppingListView list={LIST_FALSA} />);

    expect(screen.getByText(/0,50€/)).toBeTruthy();
    expect(screen.queryByTestId('shopping_list_item_0_0_cadenafalsa_link')).toBeNull();
  });

  test('the client component imports no catalog or mapper, so the catalogs stay out of the browser bundle', async () => {
    const fuente = await Bun.file(new URL('./shopping-list-view.tsx', import.meta.url)).text();

    expect(fuente).not.toMatch(/from '@\/lib\/grocery\/(map-item|line-price|shopping-list-compra|supermarket\/(registry|catalog-connectors))'/);
  });
});

describe('ShoppingListView — price disclaimer (FRESCO-790)', () => {
  const LIST_ARROZ: ShoppingListPersistido = {
    ...LIST,
    pasillos: [{
      nombre: 'Despensa',
      orden: 1,
      items: [{ nombre: 'arroz', cantidad: 500, unidad: 'g', comprado: false, precio_estimado: 0.5 }],
    }],
  };
  const enlace = (nombreCadena: string) => ({ cadena: nombreCadena.toLowerCase(), nombreCadena, url: `https://${nombreCadena.toLowerCase()}.example/arroz`, antiguedadDias: 2 });

  test('says the prices are indicative and names every chain that priced a row', () => {
    const compra: CompraPorItem = { 'Despensa::arroz': { precio: 0.5, enlaces: [enlace('Mercadona'), enlace('Consum')] } };
    renderWithProviders(<ShoppingListView list={LIST_ARROZ} compra={compra} />);
    expect(screen.getByTestId('shopping_list_price_disclaimer')).toHaveTextContent(
      'Precios orientativos de Consum y Mercadona, con la fecha en que se observaron junto a cada artículo. Pueden variar en tienda.',
    );
  });

  test('a chain that no longer prices anything is not named', () => {
    const compra: CompraPorItem = { 'Despensa::arroz': { precio: 0.5, enlaces: [enlace('Mercadona')] } };
    renderWithProviders(<ShoppingListView list={LIST_ARROZ} compra={compra} />);
    const texto = screen.getByTestId('shopping_list_price_disclaimer').textContent ?? '';
    expect(texto).toContain('Mercadona');
    expect(texto).not.toContain('Consum');
  });

  test('without any linked chain it still says the prices are indicative', () => {
    renderWithProviders(<ShoppingListView list={LIST_ARROZ} compra={{ 'Despensa::arroz': { precio: 0.5, enlaces: [] } }} />);
    expect(screen.getByTestId('shopping_list_price_disclaimer')).toHaveTextContent('Precios orientativos. Pueden variar en tienda.');
  });
});
