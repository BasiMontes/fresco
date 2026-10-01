import { describe, expect, test } from 'bun:test';
import { demandaPorProducto, sumarDemanda } from './demand';

describe('sumarDemanda', () => {
  test('keys the menu slots that need each ingredient by name', () => {
    const demanda = sumarDemanda([
      { ingrediente: 'arroz', huecos: 2 },
      { ingrediente: 'cebolla', huecos: 1 },
    ]);
    expect(demanda.get('arroz')).toBe(2);
    expect(demanda.get('cebolla')).toBe(1);
  });

  test('sums spellings that normalize to the same ingredient', () => {
    const demanda = sumarDemanda([
      { ingrediente: 'Champiñones', huecos: 2 },
      { ingrediente: 'champinones', huecos: 1 },
      { ingrediente: '  CHAMPIÑONES ', huecos: 4 },
    ]);
    expect(demanda.get('champinones')).toBe(7);
    expect(demanda.size).toBe(1);
  });

  test('drops blank names and counts that are not positive', () => {
    const demanda = sumarDemanda([
      { ingrediente: '', huecos: 3 },
      { ingrediente: '   ', huecos: 3 },
      { ingrediente: 'sal', huecos: 0 },
      { ingrediente: 'pimienta', huecos: -1 },
      { ingrediente: 'comino', huecos: Number.NaN },
    ]);
    expect(demanda.size).toBe(0);
  });

  test('an empty result is an empty map', () => {
    expect(sumarDemanda([]).size).toBe(0);
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
