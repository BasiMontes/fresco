import type { RecipeDieta } from '@schemas';
import { describe, expect, test } from 'bun:test';
import { cocinaLabel, firstActiveDietaLabel } from './labels';

describe('firstActiveDietaLabel', () => {
  const dieta = (flags: Partial<RecipeDieta>) => flags as RecipeDieta;

  // FRESCO-1310/QAFRESCO-6: every vegan recipe is also vegetarian; the tag has room for one
  // label, so it shows the more specific one.
  test('a vegan recipe is labelled "Vegano", not "Vegetariano"', () => {
    expect(firstActiveDietaLabel(dieta({ vegetariano: true, vegano: true }))).toBe('Vegano');
  });

  test('a vegetarian recipe that is not vegan stays "Vegetariano"', () => {
    expect(firstActiveDietaLabel(dieta({ vegetariano: true, vegano: false }))).toBe('Vegetariano');
  });

  test('another diet flag still labels a recipe that is neither', () => {
    expect(firstActiveDietaLabel(dieta({ sin_gluten: true }))).toBe('Sin gluten');
  });

  test('no flags and no data give no label', () => {
    expect(firstActiveDietaLabel(dieta({}))).toBeNull();
    expect(firstActiveDietaLabel(null)).toBeNull();
  });
});

describe('cocinaLabel', () => {
  test('capitalises the first letter and keeps accents', () => {
    expect(cocinaLabel('mediterránea')).toBe('Mediterránea');
    expect(cocinaLabel('asiática')).toBe('Asiática');
  });

  test('leaves an already capitalised value and the empty string alone', () => {
    expect(cocinaLabel('Española')).toBe('Española');
    expect(cocinaLabel('')).toBe('');
  });
});
