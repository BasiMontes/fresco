import type { FoodComCandidate } from './curate-foodcom-recipes';
import { describe, expect, test } from 'bun:test';
import {
  buildPrompt,
  buildResponseSchema,
  slugify,
  translatedRecipeSchema,
} from './translate-foodcom-recipes';

function buildCandidate(overrides: Partial<FoodComCandidate> = {}): FoodComCandidate {
  return {
    source_recipe_id: '42',
    name: 'Garlic Mushrooms',
    description: 'Simple garlicky mushrooms',
    ingredients_quantities: ['400 g', '2 tbsp'],
    ingredients_parts: ['mushrooms', 'garlic'],
    instructions: ['Chop garlic', 'Saute mushrooms'],
    keywords: ['quick', 'easy'],
    category: 'Vegetable',
    rating: 4.5,
    review_count: 20,
    servings: '4',
    cook_time_iso8601: 'PT20M',
    prep_time_iso8601: 'PT10M',
    total_time_iso8601: 'PT30M',
    ...overrides,
  };
}

function buildValidTranslated() {
  return {
    nombre: 'Champiñones al ajillo',
    descripcion_corta: 'Champiñones salteados con ajo.',
    meta: {
      tiempo_prep_min: 10,
      tiempo_coccion_min: 20,
      tiempo_total_min: 30,
      raciones: 4,
      coste_estimado: 'bajo',
      dificultad: 'facil',
    },
    clasificacion: {
      tipo_plato: 'comida',
      categoria: 'verdura',
      cocina: 'española',
      es_contundente: false,
      es_ligero: true,
      es_comfort_food: false,
      apto_tupper: true,
      apto_congelar: false,
    },
    dieta: {
      vegetariano: true,
      vegano: true,
      sin_gluten: true,
      sin_lactosa: true,
      sin_huevo: true,
      bajo_fodmap: false,
      keto: false,
      paleo: false,
      halal: true,
      kosher: true,
    },
    alergenos: [],
    ingredientes_principales: ['champiñones', 'ajo'],
    ingredientes_que_puede_desagradar: [],
    temporada: ['todo_el_año'],
    pasos_resumen: ['Picar el ajo', 'Saltear los champiñones'],
  };
}

describe('translatedRecipeSchema', () => {
  test('accepts a fully valid translated recipe', () => {
    const result = translatedRecipeSchema.safeParse(buildValidTranslated());
    expect(result.success).toBe(true);
  });

  test('rejects a classification value outside the known enum', () => {
    const invalid = buildValidTranslated();
    invalid.clasificacion.categoria = 'postre_inventado';
    const result = translatedRecipeSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  test('rejects an allergen outside the live vocabulary', () => {
    const invalid = { ...buildValidTranslated(), alergenos: ['mostaza'] };
    const result = translatedRecipeSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  test('rejects an empty ingredientes_principales array', () => {
    const invalid = { ...buildValidTranslated(), ingredientes_principales: [] };
    const result = translatedRecipeSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  test('rejects a missing required field', () => {
    const invalid = buildValidTranslated() as Partial<ReturnType<typeof buildValidTranslated>>;
    delete invalid.dieta;
    const result = translatedRecipeSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('buildResponseSchema', () => {
  test('is a JSON-schema object with lowercase types the Gemini interactions API expects', () => {
    const schema = buildResponseSchema();
    expect(schema.type).toBe('object');
    expect(Array.isArray(schema.required)).toBe(true);
    expect((schema.required as string[])).toContain('clasificacion');
  });
});

describe('buildPrompt', () => {
  test('includes the original name and ingredients so the model has source content to translate', () => {
    const prompt = buildPrompt(buildCandidate());
    expect(prompt).toContain('Garlic Mushrooms');
    expect(prompt).toContain('mushrooms, garlic');
  });
});

describe('slugify', () => {
  test('lowercases, strips accents, hyphenates, and suffixes the source id for guaranteed uniqueness', () => {
    expect(slugify('Champiñones al Ajillo!', '42')).toBe('champinones-al-ajillo-fc42');
  });

  test('two different source recipes with the same translated name never collide', () => {
    const a = slugify('Tarta de manzana', '1');
    const b = slugify('Tarta de manzana', '2');
    expect(a).not.toBe(b);
  });
});
