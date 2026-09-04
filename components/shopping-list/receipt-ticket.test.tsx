import type { ComponentProps } from 'react';
import { describe, expect, mock, test } from 'bun:test';
import { fireEvent, renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { ReceiptTicket } from './receipt-ticket';

/**
 * FRESCO-426-ish (receipt ticket) — the stage machine (`'printing' ->
 * 'complete'`) advances on the paper's `onAnimationEnd`, not a `setTimeout`
 * (see `app/globals.css`'s `.t-receipt-print` comment / ADR-0024 §11
 * precedent). Tests fire `animationend` synthetically instead of dealing
 * with real or faked timers.
 */

const ITEMS = [
  { nombre: 'Tomate', cantidad: 2, unidad: 'unidades' },
  { nombre: 'Pollo', cantidad: 500, unidad: 'g' },
];

function render(props: Partial<ComponentProps<typeof ReceiptTicket>> = {}) {
  return renderWithProviders(
    <ReceiptTicket open items={ITEMS} onClose={mock(() => {})} {...props} />,
  );
}

function finishPrinting() {
  fireEvent.animationEnd(screen.getByTestId('receipt_ticket_paper'));
}

describe('ReceiptTicket', () => {
  test('starts in the printing stage: spinner shown, no Listo button yet', () => {
    render();

    expect(screen.getByRole('status')).toHaveTextContent('Imprimiendo tu ticket…');
    expect(screen.queryByTestId('receipt_ticket_done_button')).toBeNull();
  });

  test('animationend on the paper flips to complete: checkmark + Listo button', () => {
    render();

    finishPrinting();

    expect(screen.getByRole('status')).toHaveTextContent('Ticket listo');
    expect(screen.getByTestId('receipt_ticket_done_button')).toBeInTheDocument();
  });

  test('clicking Listo calls onClose', async () => {
    const user = setupUser();
    const onClose = mock(() => {});
    render({ onClose });

    finishPrinting();
    await user.click(screen.getByTestId('receipt_ticket_done_button'));

    expect(onClose).toHaveBeenCalled();
  });

  test('renders each item as name + quantity/unit, singularizing "1 unidades"', () => {
    render({
      items: [
        { nombre: 'Tomate', cantidad: 2, unidad: 'unidades' },
        { nombre: 'Leche', cantidad: 1, unidad: 'unidades' },
        { nombre: 'Pollo', cantidad: 500, unidad: 'g' },
      ],
    });

    const paper = screen.getByTestId('receipt_ticket_paper');
    expect(paper).toHaveTextContent('Tomate2 unidades');
    expect(paper).toHaveTextContent('Leche1 unidad');
    expect(paper).toHaveTextContent('Pollo500 g');
    expect(paper).toHaveTextContent('3 ITEMS COMPRADOS');
  });
});
