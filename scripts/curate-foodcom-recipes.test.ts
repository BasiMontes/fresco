import type { FoodComCandidate, RawFoodComRow } from './curate-foodcom-recipes';
import { describe, expect, test } from 'bun:test';
import {
  isDuplicate,
  normalizeForDedup,
  parseRVector,
  passesRatingThreshold,
  toCandidate,
} from './curate-foodcom-recipes';

function buildRow(overrides: Partial<RawFoodComRow> = {}): RawFoodComRow {
  return {
    RecipeId: '1',
    Name: 'Garlic Mushrooms',
    Description: 'Simple garlicky mushrooms',
    RecipeIngredientQuantities: 'c("400 g", "2 tbsp")',
    RecipeIngredientParts: 'c("mushrooms", "garlic")',
    RecipeInstructions: 'c("Chop garlic", "Saute mushrooms")',
    Keywords: 'c("quick", "easy")',
    RecipeCategory: 'Vegetable',
    AggregatedRating: '4.5',
    ReviewCount: '20',
    RecipeServings: '4',
    CookTime: 'PT20M',
    PrepTime: 'PT10M',
    TotalTime: 'PT30M',
    ...overrides,
  };
}

function buildCandidate(overrides: Partial<FoodComCandidate> = {}): FoodComCandidate {
  return {
    source_recipe_id: '1',
    name: 'Garlic Mushrooms',
    description: '',
    ingredients_quantities: [],
    ingredients_parts: ['mushrooms'],
    instructions: ['Chop garlic'],
    keywords: [],
    category: '',
    rating: null,
    review_count: null,
    servings: '',
    cook_time_iso8601: '',
    prep_time_iso8601: '',
    total_time_iso8601: '',
    ...overrides,
  };
}

describe('parseRVector', () => {
  test('parses a multi-element R vector literal', () => {
    expect(parseRVector('c("a", "b", "c")')).toEqual(['a', 'b', 'c']);
  });

  test('parses an empty R vector as an empty array', () => {
    expect(parseRVector('c()')).toEqual([]);
  });

  test('trims whitespace inside each element', () => {
    expect(parseRVector('c("  a  ", "b")')).toEqual(['a', 'b']);
  });

  test('unescapes doubled internal quotes', () => {
    expect(parseRVector('c("say \\"hi\\"")')).toEqual(['say "hi"']);
  });

  test('degrades to an empty array for malformed input', () => {
    expect(parseRVector('not a vector')).toEqual(['not a vector']);
    expect(parseRVector('')).toEqual([]);
  });
});

describe('normalizeForDedup', () => {
  test('lowercases, strips accents, and collapses punctuation/whitespace', () => {
    expect(normalizeForDedup('  Café con Leche!!  ')).toBe('cafe con leche');
  });
});

describe('toCandidate — reject on missing required field', () => {
  test('rejects a row with an empty name', () => {
    expect(toCandidate(buildRow({ Name: '' }))).toBeNull();
  });

  test('rejects a row with no ingredients', () => {
    expect(toCandidate(buildRow({ RecipeIngredientParts: 'c()' }))).toBeNull();
  });

  test('rejects a row with no instructions', () => {
    expect(toCandidate(buildRow({ RecipeInstructions: 'c()' }))).toBeNull();
  });

  test('accepts a row with all required fields present', () => {
    const candidate = toCandidate(buildRow());
    expect(candidate).not.toBeNull();
    expect(candidate?.name).toBe('Garlic Mushrooms');
    expect(candidate?.ingredients_parts).toEqual(['mushrooms', 'garlic']);
    expect(candidate?.instructions).toEqual(['Chop garlic', 'Saute mushrooms']);
    expect(candidate?.source_recipe_id).toBe('1');
    expect(candidate?.rating).toBe(4.5);
  });

  test('preserves a null rating when AggregatedRating is empty, not a parse failure', () => {
    const candidate = toCandidate(buildRow({ AggregatedRating: '' }));
    expect(candidate?.rating).toBeNull();
  });
});

describe('passesRatingThreshold', () => {
  test('rejects a rated candidate below the threshold', () => {
    expect(passesRatingThreshold(buildCandidate({ rating: 2 }), 4)).toBe(false);
  });

  test('accepts a rated candidate at or above the threshold', () => {
    expect(passesRatingThreshold(buildCandidate({ rating: 4 }), 4)).toBe(true);
    expect(passesRatingThreshold(buildCandidate({ rating: 4.9 }), 4)).toBe(true);
  });

  test('accepts an unrated candidate regardless of threshold', () => {
    expect(passesRatingThreshold(buildCandidate({ rating: null }), 4)).toBe(true);
  });
});

describe('isDuplicate — dedup against existing catalog', () => {
  test('flags a case-insensitive, punctuation-loose match as a duplicate', () => {
    const existing = new Set([normalizeForDedup('Garlic Mushrooms')]);
    expect(isDuplicate(buildCandidate({ name: 'garlic mushrooms!!' }), existing)).toBe(true);
  });

  test('does not flag a genuinely different name', () => {
    const existing = new Set([normalizeForDedup('Garlic Mushrooms')]);
    expect(isDuplicate(buildCandidate({ name: 'Chocolate Cake' }), existing)).toBe(false);
  });
});
