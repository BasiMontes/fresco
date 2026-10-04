import { describe, expect, test } from 'bun:test';
import { formatSpendVsAverage } from './spend-vs-average';

const week = (costeEstimado: number | null, index = 0) => ({ semanaIso: `2026-W${index}`, costeEstimado });

describe('formatSpendVsAverage', () => {
  test('rise against the 4-week average', () => {
    const trend = [40, 40, 40, 40, 40.8].map(week);
    expect(formatSpendVsAverage(40.8, trend)).toBe('+2 % frente a tu media de 4 semanas');
  });

  test('fall with one decimal', () => {
    const trend = [40, 40, 40, 40, 39.4].map(week);
    expect(formatSpendVsAverage(39.4, trend)).toBe('−1,5 % frente a tu media de 4 semanas');
  });

  test('missing weeks are skipped, not counted as 0 €', () => {
    const trend = [week(null), week(36), week(null), week(44), week(42)];
    expect(formatSpendVsAverage(42, trend)).toBe('+5 % frente a tu media de 2 semanas');
  });

  test('only the 4 weeks before the current one count', () => {
    const trend = [100, 40, 40, 40, 40, 40.8].map(week);
    expect(formatSpendVsAverage(40.8, trend)).toBe('+2 % frente a tu media de 4 semanas');
  });

  test('a single earlier week reads as the previous week', () => {
    const trend = [week(null), week(40), week(38)];
    expect(formatSpendVsAverage(38, trend)).toBe('−5 % frente a la semana anterior');
  });

  test('no earlier week with data gives no line', () => {
    expect(formatSpendVsAverage(40, [week(null), week(null), week(40)])).toBeNull();
    expect(formatSpendVsAverage(40, [week(40)])).toBeNull();
    expect(formatSpendVsAverage(40, [])).toBeNull();
  });

  test('a 0 € average gives no line', () => {
    expect(formatSpendVsAverage(40, [week(0), week(40)])).toBeNull();
  });

  test('a change that rounds to zero reads as equal', () => {
    const trend = [40, 40, 40, 40, 40.001].map(week);
    expect(formatSpendVsAverage(40.001, trend)).toBe('Igual que tu media de 4 semanas');
  });
});
