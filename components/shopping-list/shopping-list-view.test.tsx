import type { ShoppingListPersistido } from '@/lib/api/shopping-list';
import { describe, expect, test } from 'bun:test';
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
