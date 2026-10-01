import type { PoliticaRefresco, ProductoSeguido } from './refresh-plan';
import { describe, expect, test } from 'bun:test';
import { planificarRefresco } from './refresh-plan';

const AHORA = new Date('2026-10-01T12:00:00.000Z');

const POLITICA: PoliticaRefresco = {
  maxEdadPrecioHoras: 24,
  maxPeticionesPorCadena: 10,
  pausaEntrePeticionesMs: 3000,
};

function seguido(id: string, extra: Partial<ProductoSeguido> = {}): ProductoSeguido {
  return {
    cadena: 'a',
    idExterno: id,
    zona: 'z1',
    ultimaObservacion: '2026-09-29T12:00:00.000Z',
    demanda: 1,
    ...extra,
  };
}

function ids(plan: ReturnType<typeof planificarRefresco>, cadena = 'a'): string[] {
  return (plan.porCadena[cadena] ?? []).map(p => p.idExterno);
}

describe('planificarRefresco', () => {
  test('refreshes only stale prices', () => {
    const plan = planificarRefresco({
      productos: [
        seguido('fresco', { ultimaObservacion: '2026-10-01T11:00:00.000Z' }),
        seguido('viejo', { ultimaObservacion: '2026-09-29T12:00:00.000Z' }),
      ],
      ahora: AHORA,
      politica: POLITICA,
    });
    expect(ids(plan)).toEqual(['viejo']);
  });

  test('a product never observed is refreshed', () => {
    const plan = planificarRefresco({ productos: [seguido('nuevo', { ultimaObservacion: null })], ahora: AHORA, politica: POLITICA });
    expect(ids(plan)).toEqual(['nuevo']);
  });

  test('fail-closed: an unparseable date counts as stale', () => {
    const plan = planificarRefresco({ productos: [seguido('raro', { ultimaObservacion: 'ayer' })], ahora: AHORA, politica: POLITICA });
    expect(ids(plan)).toEqual(['raro']);
  });

  test('a product no menu needs is never refreshed, however stale', () => {
    const plan = planificarRefresco({ productos: [seguido('sin-demanda', { demanda: 0 })], ahora: AHORA, politica: POLITICA });
    expect(ids(plan)).toEqual([]);
  });

  test('the most demanded goes first, then the oldest', () => {
    const plan = planificarRefresco({
      productos: [
        seguido('poca-demanda', { demanda: 1 }),
        seguido('mucha-demanda', { demanda: 5 }),
        seguido('misma-demanda-mas-vieja', { demanda: 1, ultimaObservacion: '2026-09-01T00:00:00.000Z' }),
      ],
      ahora: AHORA,
      politica: POLITICA,
    });
    expect(ids(plan)).toEqual(['mucha-demanda', 'misma-demanda-mas-vieja', 'poca-demanda']);
  });

  test('caps the requests per chain and reports what was left for later', () => {
    const plan = planificarRefresco({
      productos: [seguido('1', { demanda: 3 }), seguido('2', { demanda: 2 }), seguido('3', { demanda: 1 })],
      ahora: AHORA,
      politica: { ...POLITICA, maxPeticionesPorCadena: 2 },
    });
    expect(ids(plan)).toEqual(['1', '2']);
    expect(plan.aplazados).toBe(1);
  });

  test('each chain has its own budget', () => {
    const plan = planificarRefresco({
      productos: [
        seguido('a1', { cadena: 'a' }),
        seguido('a2', { cadena: 'a' }),
        seguido('b1', { cadena: 'b' }),
      ],
      ahora: AHORA,
      politica: { ...POLITICA, maxPeticionesPorCadena: 1 },
    });
    expect(ids(plan, 'a')).toHaveLength(1);
    expect(ids(plan, 'b')).toEqual(['b1']);
    expect(plan.aplazados).toBe(1);
  });

  test('passes the pause between requests through to the runner', () => {
    const plan = planificarRefresco({ productos: [], ahora: AHORA, politica: { ...POLITICA, pausaEntrePeticionesMs: 5000 } });
    expect(plan.pausaEntrePeticionesMs).toBe(5000);
  });

  test('is deterministic: input order does not change the plan', () => {
    const productos = [seguido('x', { demanda: 2 }), seguido('y', { demanda: 2 }), seguido('z', { demanda: 2 })];
    const directo = planificarRefresco({ productos, ahora: AHORA, politica: POLITICA });
    const invertido = planificarRefresco({ productos: [...productos].reverse(), ahora: AHORA, politica: POLITICA });
    expect(ids(invertido)).toEqual(ids(directo));
  });

  test('nothing to refresh gives an empty plan', () => {
    const plan = planificarRefresco({ productos: [], ahora: AHORA, politica: POLITICA });
    expect(plan.porCadena).toEqual({});
    expect(plan.aplazados).toBe(0);
  });
});
