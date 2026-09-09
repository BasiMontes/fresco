import { describe, expect, test } from 'bun:test';
import { HOUSEHOLD_FIELD_MAX, validateHousehold } from './onboarding';

/** Covers AC-3 ("Laura introduce un tamaño de hogar inválido"). */
describe('validateHousehold', () => {
  test('0 adults is invalid with a specific message', () => {
    const result = validateHousehold({ adultos: 0, ninos: 2 });

    expect(result.valid).toBe(false);
    expect(result.message).toBe('Indica al menos un adulto en el hogar.');
  });

  test('negative children is invalid with a specific message', () => {
    const result = validateHousehold({ adultos: 2, ninos: -1 });

    expect(result.valid).toBe(false);
    expect(result.message).toBe('El número de niños no puede ser negativo.');
  });

  test('a valid combination returns valid: true, message: null', () => {
    const result = validateHousehold({ adultos: 2, ninos: 1 });

    expect(result.valid).toBe(true);
    expect(result.message).toBeNull();
  });

  test('NaN adults (cleared number input) is invalid, not silently valid', () => {
    const result = validateHousehold({ adultos: Number.NaN, ninos: 2 });

    expect(result.valid).toBe(false);
    expect(result.message).toBe('Indica al menos un adulto en el hogar.');
  });

  test('NaN children (cleared number input) is invalid, not silently valid', () => {
    const result = validateHousehold({ adultos: 2, ninos: Number.NaN });

    expect(result.valid).toBe(false);
    expect(result.message).toBe('El número de niños no puede ser negativo.');
  });

  test('adultos above the input\'s max=10 is invalid with a specific message', () => {
    const result = validateHousehold({ adultos: 999, ninos: 0 });

    expect(result.valid).toBe(false);
    expect(result.message).toBe('El número de adultos no puede superar 10.');
  });

  test('ninos above the input\'s max=10 is invalid with a specific message', () => {
    const result = validateHousehold({ adultos: 2, ninos: 999 });

    expect(result.valid).toBe(false);
    expect(result.message).toBe('El número de niños no puede superar 10.');
  });

  test('exactly 10 adults is valid (boundary)', () => {
    const result = validateHousehold({ adultos: 10, ninos: 0 });

    expect(result.valid).toBe(true);
    expect(result.message).toBeNull();
  });

  // FRESCO-465 — explicit boundary-value batch around HOUSEHOLD_FIELD_MAX and
  // the lower bounds for both fields. FRESCO-110's regression was exactly a
  // frontier one (the max was never enforced).
  describe('boundary-value matrix (FRESCO-465)', () => {
    test('the field max constant is 10', () => {
      expect(HOUSEHOLD_FIELD_MAX).toBe(10);
    });

    test.each([
      ['adultos 0', { adultos: 0, ninos: 0 }, 'Indica al menos un adulto en el hogar.'],
      ['adultos -1 (negative)', { adultos: -1, ninos: 0 }, 'Indica al menos un adulto en el hogar.'],
      ['adultos 11 (max + 1)', { adultos: 11, ninos: 0 }, 'El número de adultos no puede superar 10.'],
      ['ninos -1 (negative)', { adultos: 1, ninos: -1 }, 'El número de niños no puede ser negativo.'],
      ['ninos 11 (max + 1)', { adultos: 1, ninos: 11 }, 'El número de niños no puede superar 10.'],
    ] as const)('rejects %s', (_label, input, message) => {
      const result = validateHousehold(input);
      expect(result.valid).toBe(false);
      expect(result.message).toBe(message);
    });

    test.each([
      ['adultos 1 / ninos 0 (both lower bounds)', { adultos: 1, ninos: 0 }],
      ['adultos 10 / ninos 10 (both upper bounds)', { adultos: 10, ninos: 10 }],
      ['adultos 1 / ninos 10', { adultos: 1, ninos: 10 }],
    ] as const)('accepts %s', (_label, input) => {
      const result = validateHousehold(input);
      expect(result.valid).toBe(true);
      expect(result.message).toBeNull();
    });
  });
});
