import type { Recipe } from '@schemas';
import { describe, expect, test } from 'bun:test';
import { countActiveFilters, countWithOption, EMPTY_FILTER_STATE, matchesRecipeFilters } from '@/lib/recipes/recipe-filters';

function makeRecipe(overrides: Partial<Recipe>): Recipe {
  return {
    id: 'id',
    created_at: '',
    updated_at: '',
    nombre: 'Receta',
    slug: 'receta',
    descripcion_corta: null,
    foto_url: null,
    meta: null,
    clasificacion: null,
    dieta: null,
    alergenos: null,
    ingredientes_principales: null,
    ingredientes_que_puede_desagradar: null,
    temporada: null,
    pasos_resumen: null,
    veces_cocinada: 0,
    veces_descartada: 0,
    rating_promedio: null,
    ultima_vez_en_menu: null,
    ...overrides,
  } as Recipe;
}

describe('lib/recipes/recipe-filters', () => {
  test('empty filter state matches everything', () => {
    const recipe = makeRecipe({});
    expect(matchesRecipeFilters(recipe, EMPTY_FILTER_STATE)).toBe(true);
  });

  test('mealTypes is OR within the section', () => {
    const desayuno = makeRecipe({ clasificacion: { tipo_plato: 'desayuno', cocina: 'española' } as Recipe['clasificacion'] });
    const cena = makeRecipe({ clasificacion: { tipo_plato: 'cena', cocina: 'española' } as Recipe['clasificacion'] });
    const filters = { ...EMPTY_FILTER_STATE, mealTypes: ['desayuno', 'cena'] as const };
    expect(matchesRecipeFilters(desayuno, filters as never)).toBe(true);
    expect(matchesRecipeFilters(cena, filters as never)).toBe(true);
  });

  test('sections combine with AND', () => {
    const matches = makeRecipe({
      clasificacion: { tipo_plato: 'cena', cocina: 'italiana' } as Recipe['clasificacion'],
      dieta: { vegano: true } as Recipe['dieta'],
    });
    const filters = { ...EMPTY_FILTER_STATE, cocinas: ['italiana'], dietas: ['vegano' as const] };
    expect(matchesRecipeFilters(matches, filters as never)).toBe(true);

    const wrongCocina = makeRecipe({
      clasificacion: { tipo_plato: 'cena', cocina: 'mexicana' } as Recipe['clasificacion'],
      dieta: { vegano: true } as Recipe['dieta'],
    });
    expect(matchesRecipeFilters(wrongCocina, filters as never)).toBe(false);
  });

  test('alergenos is exclusion, not inclusion', () => {
    const withGluten = makeRecipe({ alergenos: ['gluten'] as Recipe['alergenos'] });
    const withoutGluten = makeRecipe({ alergenos: ['pescado'] as Recipe['alergenos'] });
    const filters = { ...EMPTY_FILTER_STATE, alergenos: ['gluten'] };
    expect(matchesRecipeFilters(withGluten, filters)).toBe(false);
    expect(matchesRecipeFilters(withoutGluten, filters)).toBe(true);
  });

  test('countWithOption previews one value in a section, ignoring the section\'s own current selection', () => {
    const italiana = makeRecipe({ clasificacion: { tipo_plato: 'cena', cocina: 'italiana' } as Recipe['clasificacion'] });
    const mexicana = makeRecipe({ clasificacion: { tipo_plato: 'cena', cocina: 'mexicana' } as Recipe['clasificacion'] });
    const recipes = [italiana, mexicana];

    const filters = { ...EMPTY_FILTER_STATE, cocinas: ['italiana'] };
    expect(countWithOption(recipes, filters, 'cocinas', 'mexicana')).toBe(1);
  });

  test('countActiveFilters sums every section', () => {
    const filters = { mealTypes: ['cena' as const], cocinas: ['italiana', 'mexicana'], dietas: [], alergenos: ['gluten'] };
    expect(countActiveFilters(filters)).toBe(4);
  });
});
