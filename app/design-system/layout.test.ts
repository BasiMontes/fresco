import { describe, expect, test } from 'bun:test';
import { metadata } from './layout';

describe('design-system layout metadata', () => {
  test('is noindex, nofollow (FRESCO-1207)', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
