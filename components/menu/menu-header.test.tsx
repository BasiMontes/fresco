import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { MenuHeader } from './menu-header';

/** FRESCO-972 (UX-26): a missing name must not leave a bare "¡Hola!"; it links to the field. */
describe('MenuHeader greeting', () => {
  test('with a name, greets her and offers no link', () => {
    renderWithProviders(<MenuHeader nombre="Laura" hasUnseenNotifications={false} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('¡Hola, Laura!');
    expect(screen.queryByTestId('menu_add_name_link')).toBeNull();
  });

  test('without a name, links to the "Tu nombre" field on /profile', () => {
    renderWithProviders(<MenuHeader nombre={null} hasUnseenNotifications={false} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('¡Hola!');
    expect(screen.getByTestId('menu_add_name_link')).toHaveAttribute('href', '/profile#nombre');
  });
});

/** FRESCO-234: the bell shows a binary red dot when something is unseen, never a number. */
describe('MenuHeader notifications badge', () => {
  test('with unseen notifications it shows a red dot with no number', () => {
    renderWithProviders(<MenuHeader nombre="Laura" hasUnseenNotifications />);

    const badge = screen.getByTestId('notificaciones_badge');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toBe('');
    expect(screen.getByTestId('notificaciones_button').textContent).not.toMatch(/\d/);
  });

  test('with nothing unseen the bell has no badge at all', () => {
    renderWithProviders(<MenuHeader nombre="Laura" hasUnseenNotifications={false} />);

    expect(screen.queryByTestId('notificaciones_badge')).toBeNull();
  });
});
