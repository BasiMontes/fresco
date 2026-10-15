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
