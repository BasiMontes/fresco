import type { RecetaPropia } from '@schemas';
import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { PersonalRecipeCard } from './personal-recipe-card';

/**
 * regression.feature, "Tus recetas" grid: a personal recipe card clamps a very long name to two
 * lines (the second defence behind the form's maxLength) and pluralizes its ingredient count.
 */

function receta(nombre: string, ingredientes: string[]): RecetaPropia {
  return { id: 'r1', nombre, ingredientes, pasos: [], created_at: '', updated_at: '', user_id: 'u1' };
}

describe('PersonalRecipeCard', () => {
  test('clamps a 1000-character name to two lines so the grid row stays aligned', () => {
    const nombre = 'a'.repeat(1000);
    renderWithProviders(<PersonalRecipeCard receta={receta(nombre, ['tomate'])} />);

    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toHaveTextContent(nombre);
    expect(heading.className).toContain('line-clamp-2');
  });

  test('a recipe with one ingredient reads "1 ingrediente", not "1 ingredientes"', () => {
    renderWithProviders(<PersonalRecipeCard receta={receta('Tortilla', ['huevo'])} />);

    expect(screen.getByText(/^1\s+ingrediente$/)).toBeInTheDocument();
    expect(screen.queryByText(/ingredientes/)).toBeNull();
  });

  test('a recipe with two ingredients reads "2 ingredientes"', () => {
    renderWithProviders(<PersonalRecipeCard receta={receta('Tortilla', ['huevo', 'patata'])} />);

    expect(screen.getByText(/^2\s+ingredientes$/)).toBeInTheDocument();
  });
});
