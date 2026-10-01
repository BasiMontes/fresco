import { describe, expect, test } from 'bun:test';
import { contarDemanda, demandaPorProducto } from './demand';

describe('contarDemanda', () => {
  test('counts the menu slots that need each ingredient', () => {
    const demanda = contarDemanda([
      { ingredientes: ['arroz', 'cebolla'] },
      { ingredientes: ['arroz'] },
      { ingredientes: ['leche'] },
    ]);
    expect(demanda.get('arroz')).toBe(2);
    expect(demanda.get('cebolla')).toBe(1);
    expect(demanda.get('leche')).toBe(1);
  });

  test('normalizes names, so accents and case do not split an ingredient', () => {
    const demanda = contarDemanda([
      { ingredientes: ['Champiñones'] },
      { ingredientes: ['champinones'] },
      { ingredientes: ['  CHAMPIÑONES '] },
    ]);
    expect(demanda.get('champinones')).toBe(3);
    expect(demanda.size).toBe(1);
  });

  test('counts an ingredient once per slot, however often the recipe lists it', () => {
    const demanda = contarDemanda([{ ingredientes: ['ajo', 'Ajo', 'ajo '] }]);
    expect(demanda.get('ajo')).toBe(1);
  });

  test('ignores blank names and an empty menu', () => {
    expect(contarDemanda([{ ingredientes: ['', '   '] }]).size).toBe(0);
    expect(contarDemanda([]).size).toBe(0);
  });
});

describe('demandaPorProducto', () => {
  test('sums the demand of every ingredient a product is matched to', () => {
    const demanda = demandaPorProducto(
      [
        { ingrediente: 'arroz', productoId: 1 },
        { ingrediente: 'arroz integral', productoId: 1 },
        { ingrediente: 'leche', productoId: 2 },
      ],
      new Map([['arroz', 2], ['arroz integral', 3], ['leche', 1]]),
    );
    expect(demanda.get(1)).toBe(5);
    expect(demanda.get(2)).toBe(1);
  });

  test('a product nobody needs gets no entry', () => {
    const demanda = demandaPorProducto(
      [{ ingrediente: 'trufa', productoId: 9 }],
      new Map([['arroz', 2]]),
    );
    expect(demanda.has(9)).toBe(false);
  });

  test('matches ingredient names regardless of accents and case', () => {
    const demanda = demandaPorProducto(
      [{ ingrediente: 'Champiñones', productoId: 4 }],
      new Map([['champinones', 2]]),
    );
    expect(demanda.get(4)).toBe(2);
  });
});
