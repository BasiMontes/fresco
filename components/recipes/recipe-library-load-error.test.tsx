import { afterEach, describe, expect, test } from 'bun:test';
import { renderWithProviders, screen, setupUser } from '@/tests/component-render';
import { routerMock } from '@/tests/mocks/next-navigation';
import { RecipeLibraryLoadError } from './recipe-library-load-error';

/**
 * FRESCO-855 — a failed catalog read shows an error with a retry, not the
 * "no hay recetas" empty catalog it used to fall back to.
 */
describe('RecipeLibraryLoadError', () => {
  afterEach(() => {
    routerMock.refresh.mockClear();
  });

  test('says the catalog could not be loaded instead of claiming there are no recipes', () => {
    renderWithProviders(<RecipeLibraryLoadError />);

    expect(screen.getByTestId('recipe_library_load_error')).toHaveTextContent('No hemos podido cargar el catálogo');
    expect(screen.queryByText(/no hay recetas/i)).toBeNull();
  });

  test('"Reintentar" re-runs the page read', async () => {
    const user = setupUser();
    renderWithProviders(<RecipeLibraryLoadError />);

    await user.click(screen.getByTestId('recipe_library_retry_button'));

    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });
});
