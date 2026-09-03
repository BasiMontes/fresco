import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { Faq } from './faq';

/**
 * FRESCO-409 — the landing FAQ is a single-open accordion: opening one
 * question closes any other, and clicking an open question closes it. Tests
 * pin that exclusivity and the `aria-expanded` wiring.
 */

describe('Faq', () => {
  test('renders every question collapsed', () => {
    renderWithProviders(<Faq />);

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(6);
    buttons.forEach(button => expect(button).toHaveAttribute('aria-expanded', 'false'));
    expect(screen.queryByText(/El plan Free es gratis para siempre/)).toBeNull();
  });

  test('opens a question on click and marks it expanded', async () => {
    const user = setupUser();
    renderWithProviders(<Faq />);

    await user.click(screen.getByRole('button', { name: /Necesito tarjeta para el plan Free/ }));

    expect(screen.getByText(/El plan Free es gratis para siempre/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Necesito tarjeta/ })).toHaveAttribute('aria-expanded', 'true');
  });

  test('opening a second question closes the first', async () => {
    const user = setupUser();
    renderWithProviders(<Faq />);

    await user.click(screen.getByRole('button', { name: /Necesito tarjeta/ }));
    await user.click(screen.getByRole('button', { name: /Qué pasa con mis alergias/ }));

    expect(screen.queryByText(/El plan Free es gratis para siempre/)).toBeNull();
    expect(screen.getByText(/Los filtros de alergias son absolutos/)).toBeInTheDocument();
  });

  test('clicking an open question closes it', async () => {
    const user = setupUser();
    renderWithProviders(<Faq />);
    const button = screen.getByRole('button', { name: /Necesito tarjeta/ });

    await user.click(button);
    await user.click(button);

    expect(screen.queryByText(/El plan Free es gratis para siempre/)).toBeNull();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});
