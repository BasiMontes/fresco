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

  // FRESCO-981 — a long catalog title (up to 66 characters, 6 lines on a 320px phone)
  // is shown in full; the clamp is only a guard against a pathological name.
  test('lets the title use up to six lines, and keeps the struck-through style when discarded', () => {
    const recipe = { nombre: 'Berenjena rellena de levadura nutricional con semillas de calabaza', clasificacion: null, dieta: {} } as unknown as Recipe;
    renderWithProviders(<SlotContent dia="lunes" tipo="comida" recipe={recipe} estado="descartada" />);

    const title = screen.getByRole('heading', { level: 2 });

    expect(title).toHaveClass('line-clamp-6');
    expect(title).not.toHaveClass('line-clamp-3');
    expect(title).toHaveClass('line-through');
  });
});
