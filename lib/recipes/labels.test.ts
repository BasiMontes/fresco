import { describe, expect, test } from 'bun:test';
import { cocinaLabel } from './labels';

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
