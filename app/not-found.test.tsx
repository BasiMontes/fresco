import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import NotFound, { metadata } from './not-found';

/**
 * FRESCO-894 — the 404 page inherited the home page's <title>, so a tab or a crawler could not
 * tell a broken link from the front page. It now has its own, in the "Page · Fresco" shape the
 * other routes use. The status stays a real 404: Next.js sets it, this only pins the copy.
 */
describe('not-found page', () => {
  test('has its own title, different from the home page one', () => {
    expect(metadata.title).toBe('Página no encontrada · Fresco');
    expect(metadata.title).not.toContain('Planificador');
  });

  test('tells the user the page is missing and offers a way home', () => {
    renderWithProviders(<NotFound />);

    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument();
    expect(screen.getByTestId('not_found_home_link')).toHaveAttribute('href', '/');
  });
});
