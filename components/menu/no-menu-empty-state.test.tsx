import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { NoMenuEmptyState } from './no-menu-empty-state';

/**
 * FRESCO-980 (UX-26) — the shopping list and the calendar showed the
 * dashboard's empty-state words verbatim. The copy is now overridable per
 * caller, and the default (used by `/menu`) must stay unchanged.
 */

describe('NoMenuEmptyState', () => {
  test('keeps the original copy by default, so /menu is unchanged', () => {
    renderWithProviders(<NoMenuEmptyState data-testid="empty" />);

    expect(screen.getByText('Todavía no tienes un menú para esta semana')).toBeInTheDocument();
    expect(screen.getByText('Completa tu perfil y genera tu primer menú semanal en unos segundos.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Generar mi menú/ })).toHaveAttribute('href', '/onboarding');
  });

  test('uses its own title and description when the caller passes them', () => {
    renderWithProviders(
      <NoMenuEmptyState
        data-testid="empty"
        titleAs="h1"
        title="Todavía no hay lista de la compra"
        description="Tu lista se genera a partir del menú de la semana."
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Todavía no hay lista de la compra' })).toBeInTheDocument();
    expect(screen.getByText('Tu lista se genera a partir del menú de la semana.')).toBeInTheDocument();
    expect(screen.queryByText('Todavía no tienes un menú para esta semana')).toBeNull();
  });

  test('overrides only the description and keeps the default title', () => {
    renderWithProviders(<NoMenuEmptyState data-testid="empty" description="Genera el menú y reorganiza los platos." />);

    expect(screen.getByText('Todavía no tienes un menú para esta semana')).toBeInTheDocument();
    expect(screen.getByText('Genera el menú y reorganiza los platos.')).toBeInTheDocument();
    expect(screen.queryByText('Completa tu perfil y genera tu primer menú semanal en unos segundos.')).toBeNull();
  });
});
