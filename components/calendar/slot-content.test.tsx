import type { Recipe } from '@schemas';
import { describe, expect, test } from 'bun:test';
import { renderWithProviders, screen } from '@/tests/component-render';
import { SlotContent } from './slot-content';

/** FRESCO-968 (UX-27) — a slot's recipe title is an h2, one level under `/calendar`'s h1. */

describe('SlotContent', () => {
  test('renders the recipe name as an h2', () => {
    const recipe = { nombre: 'Lentejas estofadas', clasificacion: null, dieta: {} } as unknown as Recipe;
    renderWithProviders(<SlotContent dia="lunes" tipo="comida" recipe={recipe} estado="pendiente" />);

    expect(screen.getByRole('heading', { name: 'Lentejas estofadas', level: 2 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
  });
});
