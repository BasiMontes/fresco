import type { HealthDataFields } from './health-data-consent';
import { describe, expect, test } from 'bun:test';
import { collectsHealthData, isHealthConsentSatisfied } from './health-data-consent';

const NOTHING: HealthDataFields = {
  dietaVegetariano: false,
  dietaVegano: false,
  dietaSinGluten: false,
  dietaSinLactosa: false,
  dietaSinHuevo: false,
  dietaKeto: false,
  dietaHalal: false,
  alergenos: [],
  dietaTextoLibre: '',
};

describe('collectsHealthData', () => {
  test('false when nothing health-related is filled in', () => {
    expect(collectsHealthData(NOTHING)).toBe(false);
  });

  test('true for any allergen', () => {
    expect(collectsHealthData({ ...NOTHING, alergenos: ['gluten'] })).toBe(true);
  });

  test.each([
    'dietaVegetariano',
    'dietaVegano',
    'dietaSinGluten',
    'dietaSinLactosa',
    'dietaSinHuevo',
    'dietaKeto',
    'dietaHalal',
  ] as const)('true when %s is on', (flag) => {
    expect(collectsHealthData({ ...NOTHING, [flag]: true })).toBe(true);
  });

  test('true for free text, false for whitespace only', () => {
    expect(collectsHealthData({ ...NOTHING, dietaTextoLibre: 'celíaca diagnosticada' })).toBe(true);
    expect(collectsHealthData({ ...NOTHING, dietaTextoLibre: '   ' })).toBe(false);
  });
});

describe('isHealthConsentSatisfied', () => {
  test('true when there is no health data, ticked or not', () => {
    expect(isHealthConsentSatisfied({ ...NOTHING, healthDataConsent: false })).toBe(true);
    expect(isHealthConsentSatisfied({ ...NOTHING, healthDataConsent: true })).toBe(true);
  });

  test('false with health data and no consent', () => {
    expect(isHealthConsentSatisfied({ ...NOTHING, alergenos: ['gluten'], healthDataConsent: false })).toBe(false);
  });

  test('true with health data once the consent is ticked', () => {
    expect(isHealthConsentSatisfied({ ...NOTHING, alergenos: ['gluten'], healthDataConsent: true })).toBe(true);
  });
});
