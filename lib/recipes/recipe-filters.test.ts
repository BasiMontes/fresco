import { describe, expect, test } from 'bun:test';
import { countActiveFilters } from '@/lib/recipes/recipe-filters';

describe('lib/recipes/recipe-filters', () => {
  test('countActiveFilters sums every section', () => {
    const filters = { mealTypes: ['cena' as const], cocinas: ['italiana', 'mexicana'], dietas: [], alergenos: ['gluten'] };
    expect(countActiveFilters(filters)).toBe(4);
  });

  test('countActiveFilters is zero for an empty state', () => {
    expect(countActiveFilters({ mealTypes: [], cocinas: [], dietas: [], alergenos: [] })).toBe(0);
  });
});
