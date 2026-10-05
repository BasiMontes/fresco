import type { IngredienteParaMatching } from './matcher';
import { describe, expect, test } from 'bun:test';
import { PRODUCTOS_SINTETICOS } from './fake-connector';
import { emparejarIngrediente, ingredienteParaMatching, MAX_RATIO_ENVASE_PORCION } from './matcher';

function ingrediente(terminos: string[], porcion: IngredienteParaMatching['porcion']): IngredienteParaMatching {
  return { terminos, porcion };
}

describe('emparejarIngrediente', () => {
  test('picks a plausible pack among products that start with the term', () => {
    const match = emparejarIngrediente({
      ingrediente: ingrediente(['arroz'], { cantidad: 200, unidad: 'g' }),
      candidatos: PRODUCTOS_SINTETICOS,
    });
    expect(match?.producto.idExterno).toBe('p-001');
    expect(match?.confianza).toBe('alta');
    expect(match?.termino).toBe('arroz');
  });

  test('rejects a bulk pack that is implausible for one recipe portion', () => {
    const match = emparejarIngrediente({
      ingrediente: ingrediente(['leche'], { cantidad: 200, unidad: 'ml' }),
      candidatos: PRODUCTOS_SINTETICOS,
    });
    // The 6 l pack (30x the portion) is out; the 1 l brik (5x) stays.
    expect(match?.producto.idExterno).toBe('p-004');
    expect(6000 / 200).toBeGreaterThan(MAX_RATIO_ENVASE_PORCION);
  });

  test('the canonical term wins over a synonym when it matches', () => {
    const match = emparejarIngrediente({
      ingrediente: ingrediente(['aceite de oliva', 'aceite'], { cantidad: 50, unidad: 'ml' }),
      candidatos: PRODUCTOS_SINTETICOS,
    });
    expect(match?.producto.idExterno).toBe('p-006');
    expect(match?.confianza).toBe('alta');
  });

  test('falls back to a synonym, with lower confidence, when the canonical term has no match', () => {
    const match = emparejarIngrediente({
      ingrediente: ingrediente(['aceite de vino', 'aceite'], { cantidad: 50, unidad: 'ml' }),
      candidatos: PRODUCTOS_SINTETICOS,
    });
    // Both oils match "aceite"; the sunflower one is cheaper per litre.
    expect(match?.producto.idExterno).toBe('p-007');
    expect(match?.termino).toBe('aceite');
    expect(match?.confianza).toBe('media');
  });

  test('an out-of-stock product is never matched', () => {
    expect(emparejarIngrediente({
      ingrediente: ingrediente(['pasta'], { cantidad: 100, unidad: 'g' }),
      candidatos: PRODUCTOS_SINTETICOS,
    })).toBeNull();
  });

  test('a pack in another unit family is never matched', () => {
    expect(emparejarIngrediente({
      ingrediente: ingrediente(['huevos'], { cantidad: 100, unidad: 'g' }),
      candidatos: PRODUCTOS_SINTETICOS,
    })).toBeNull();
  });

  test('the term must start a word: "omate" does not match "tomate"', () => {
    expect(emparejarIngrediente({
      ingrediente: ingrediente(['omate'], { cantidad: 100, unidad: 'g' }),
      candidatos: PRODUCTOS_SINTETICOS,
    })).toBeNull();
  });

  test('a product that starts with the term beats one that only contains it', () => {
    const match = emparejarIngrediente({
      ingrediente: ingrediente(['tomate'], { cantidad: 100, unidad: 'g' }),
      candidatos: PRODUCTOS_SINTETICOS,
    });
    expect(match?.producto.idExterno).toBe('p-008');
    expect(match?.confianza).toBe('alta');
  });

  // FRESCO-785: "Salsa con tomate frito y cebolla" is a sauce that contains the
  // term, not the ingredient. No reliable match shows nothing rather than it.
  test('a product that only has the term as an add-in is not a match', () => {
    const solo = PRODUCTOS_SINTETICOS.filter(p => p.idExterno === 'p-009');
    const match = emparejarIngrediente({
      ingrediente: ingrediente(['tomate'], { cantidad: 100, unidad: 'g' }),
      candidatos: solo,
    });
    expect(match).toBeNull();
  });

  describe('tie-break (FRESCO-846): the plain product wins, not the cheapest per kg', () => {
    const base = { ...PRODUCTOS_SINTETICOS[0], disponible: true, envase: { cantidad: 500, unidad: 'g' as const } };
    const porcion = { cantidad: 200, unidad: 'g' as const };

    test('a shorter name beats a cheaper derived or mixed product', () => {
      const match = emparejarIngrediente({
        ingrediente: ingrediente(['brocoli'], porcion),
        candidatos: [
          { ...base, idExterno: 'a', nombre: 'Brocoli ultracongelado paquete', precioEnvase: 0.9 },
          { ...base, idExterno: 'b', nombre: 'Brocoli pieza', precioEnvase: 1.8 },
        ],
      });
      expect(match?.producto.idExterno).toBe('b');
    });

    test('same name: the smaller pack wins, then the cheaper one, then the id', () => {
      const candidatos = [
        { ...base, idExterno: 'z', nombre: 'Leche entera brik', envase: { cantidad: 1000, unidad: 'g' as const }, precioEnvase: 1.4 },
        { ...base, idExterno: 'y', nombre: 'Leche entera brik', envase: { cantidad: 1000, unidad: 'g' as const }, precioEnvase: 0.96 },
        { ...base, idExterno: 'x', nombre: 'Leche entera brik', envase: { cantidad: 1000, unidad: 'g' as const }, precioEnvase: 0.96 },
        { ...base, idExterno: 'w', nombre: 'Leche entera brik', envase: { cantidad: 2000, unidad: 'g' as const }, precioEnvase: 0.5 },
      ];
      const match = emparejarIngrediente({ ingrediente: ingrediente(['leche'], { cantidad: 200, unidad: 'g' }), candidatos });
      expect(match?.producto.idExterno).toBe('x');
    });
  });

  test('is deterministic: candidate order does not change the result', () => {
    const entrada = ingrediente(['arroz'], { cantidad: 200, unidad: 'g' });
    const directo = emparejarIngrediente({ ingrediente: entrada, candidatos: PRODUCTOS_SINTETICOS });
    const invertido = emparejarIngrediente({ ingrediente: entrada, candidatos: [...PRODUCTOS_SINTETICOS].reverse() });
    expect(invertido?.producto.idExterno).toBe(directo?.producto.idExterno ?? '');
  });

  test('the ratio limit can be tightened', () => {
    const match = emparejarIngrediente({
      ingrediente: ingrediente(['arroz'], { cantidad: 200, unidad: 'g' }),
      candidatos: PRODUCTOS_SINTETICOS,
      maxRatio: 3,
    });
    // 3 x 200 g = 600 g: only the 500 g basmati pack fits.
    expect(match?.producto.idExterno).toBe('p-002');
  });

  test('returns null when there are no candidates', () => {
    expect(emparejarIngrediente({ ingrediente: ingrediente(['arroz'], { cantidad: 200, unidad: 'g' }), candidatos: [] })).toBeNull();
  });
});

describe('ingredienteParaMatching (adapter from the FRESCO-488 dictionary)', () => {
  const entrada = {
    canonico: 'Aceite de oliva',
    terminoBusqueda: 'aceite oliva virgen',
    sinonimos: ['AOVE', 'aceite de oliva'],
    porcionReceta: { cantidad: 15, unidad: 'ml' },
  };

  test('orders terms canonical first, normalizes them and drops duplicates', () => {
    expect(ingredienteParaMatching(entrada)?.terminos).toEqual(['aceite de oliva', 'aceite oliva virgen', 'aove']);
  });

  test('keeps the recipe portion as the base-unit pack the match must fit', () => {
    expect(ingredienteParaMatching(entrada)?.porcion).toEqual({ cantidad: 15, unidad: 'ml' });
  });

  test('strips accents from terms', () => {
    const atun = ingredienteParaMatching({ ...entrada, canonico: 'Atún', terminoBusqueda: 'Atún', sinonimos: [], porcionReceta: { cantidad: 80, unidad: 'g' } });
    expect(atun?.terminos).toEqual(['atun']);
  });

  test('count-based and empty portions are out of scope', () => {
    expect(ingredienteParaMatching({ ...entrada, porcionReceta: { cantidad: 2, unidad: 'unidades' } })).toBeNull();
    expect(ingredienteParaMatching({ ...entrada, porcionReceta: { cantidad: 0, unidad: 'g' } })).toBeNull();
  });
});
