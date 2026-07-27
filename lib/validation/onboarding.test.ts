import { describe, expect, test } from 'bun:test';
import { validateHousehold } from './onboarding';

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
});
