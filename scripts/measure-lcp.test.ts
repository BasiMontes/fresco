import { describe, expect, test } from 'bun:test';
import { median } from './measure-lcp';

describe('median', () => {
  test('returns the middle value of an odd-length list', () => {
    expect(median([760, 628, 676, 680, 672])).toBe(676);
  });

  test('averages the two middle values of an even-length list', () => {
    expect(median([100, 200, 300, 400])).toBe(250);
  });

  test('does not depend on input order and does not mutate it', () => {
    const input = [3, 1, 2];
    expect(median(input)).toBe(2);
    expect(input).toEqual([3, 1, 2]);
  });

  test('a single outlier does not move the median', () => {
    expect(median([650, 660, 670, 5000, 680])).toBe(670);
  });
});
