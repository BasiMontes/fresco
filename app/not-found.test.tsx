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

/** FRESCO-1013 (A7-UI-01): the root layout's skip link targets #main; a 404 without it had no landmark. */
describe('not-found landmark', () => {
  test('the content sits in <main id="main">, the target of the skip link', () => {
    const { container } = renderWithProviders(<NotFound />);

    const main = container.querySelector('main#main');
    expect(main).not.toBeNull();
    expect(main?.querySelector('h1')).not.toBeNull();
  });
});
