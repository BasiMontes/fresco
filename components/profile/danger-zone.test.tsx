import { describe, expect, test } from 'bun:test';
import { AccountActions } from '@/components/profile/danger-zone';
import { renderWithProviders, screen } from '@/tests/component-render';
import '@/tests/mocks/next-navigation';

/**
 * FRESCO-862 — `/profile` must not show two "Cerrar sesión" on desktop.
 * From `md` up the sidebar account menu already has it; below `md` there is no
 * sidebar (and the bottom tab bar has no logout), so the profile row is the only
 * way out and must stay. Tailwind classes are what encode that rule, so the test
 * pins them (design plan §5-Y).
 */
describe('AccountActions logout row', () => {
  test('is hidden from md up so the sidebar account menu is the only logout on desktop', () => {
    renderWithProviders(<AccountActions />);

    const row = screen.getByTestId('logout_button').closest('div.flex');
    expect(row?.className).toContain('md:hidden');
  });

  test('is not hidden below md, where it is the only way out', () => {
    renderWithProviders(<AccountActions />);

    const row = screen.getByTestId('logout_button').closest('div.flex');
    expect(row?.className).not.toMatch(/(^|\s)hidden(\s|$)/);
  });

  test('keeps the CSV backup visible at every width', () => {
    renderWithProviders(<AccountActions />);

    const row = screen.getByTestId('export_data_link').closest('div.flex');
    expect(row?.className).not.toContain('hidden');
  });
});
