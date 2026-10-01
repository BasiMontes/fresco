import type { SupermarketConnector } from './connector';
import type { PlanRefresco } from './refresh-plan';
import type { ProductoSupermercado } from './types';
import { describe, expect, test } from 'bun:test';
import { BloqueoError, crearRegistro, LimiteDeTasaError } from './connector';
import { crearConectorFalso } from './fake-connector';
import { ejecutarRefresco } from './refresh-run';

const PAUSA = 3000;

function producto(cadena: string, idExterno: string): ProductoSupermercado {
  return {
    cadena,
    idExterno,
    nombre: idExterno,
    marca: null,
    envase: { cantidad: 500, unidad: 'g' },
    precioEnvase: 1.5,
    url: null,
    disponible: true,
    zona: 'z1',
    observadoEn: '2026-10-01T12:00:00.000Z',
  };
}

type Respuesta = ProductoSupermercado | null | Error;

/** A connector whose answers per product are scripted; the last one repeats. */
function conectorGuionizado(
  cadena: string,
  guion: Record<string, Respuesta[]>,
  extra: Partial<Pick<SupermarketConnector, 'permiso' | 'permisoRef'>> = {},
) {
  const llamadas: string[] = [];
  const base = crearConectorFalso({ cadena, ...extra });
  const conector: SupermarketConnector = {
    ...base,
    async obtenerProducto(idExterno) {
      llamadas.push(idExterno);
      const respuestas = guion[idExterno] ?? [producto(cadena, idExterno)];
      const respuesta = respuestas.length > 1 ? respuestas.shift()! : respuestas[0];
      if (respuesta instanceof Error) {
        throw respuesta;
      }
      return respuesta;
    },
  };
  return { conector, llamadas };
}

function plan(porCadena: Record<string, string[]>, aplazados = 0): PlanRefresco {
  return {
    porCadena: Object.fromEntries(
      Object.entries(porCadena).map(([cadena, ids]) => [cadena, ids.map(idExterno => ({ cadena, idExterno, zona: 'z1' }))]),
    ),
    pausaEntrePeticionesMs: PAUSA,
    aplazados,
  };
}

function entorno(conectores: SupermarketConnector[]) {
  const guardados: string[] = [];
  const esperas: number[] = [];
  return {
    guardados,
    esperas,
    deps: {
      registro: crearRegistro(conectores),
      guardar: async (p: ProductoSupermercado) => { guardados.push(`${p.cadena}:${p.idExterno}`); },
      esperar: async (ms: number) => { esperas.push(ms); },
    },
  };
}

describe('ejecutarRefresco', () => {
  test('fetches every planned product in order, pausing between requests but not after the last', async () => {
    const { conector, llamadas } = conectorGuionizado('a', {});
    const { deps, guardados, esperas } = entorno([conector]);

    const informe = await ejecutarRefresco(plan({ a: ['p1', 'p2', 'p3'] }), deps);

    expect(llamadas).toEqual(['p1', 'p2', 'p3']);
    expect(guardados).toEqual(['a:p1', 'a:p2', 'a:p3']);
    expect(esperas).toEqual([PAUSA, PAUSA]);
    expect(informe.porCadena).toEqual([
      { cadena: 'a', estado: 'completada', observaciones: 3, sinDatos: 0, fallos: 0, esperasPorLimite: 0, aplazadas: 0 },
    ]);
  });

  test('passes the budget the plan already deferred through to the report', async () => {
    const { conector } = conectorGuionizado('a', {});
    const informe = await ejecutarRefresco(plan({ a: ['p1'] }, 7), entorno([conector]).deps);
    expect(informe.aplazadosPorPresupuesto).toBe(7);
  });

  describe('the legal gate', () => {
    test('a chain whose permission is pending is never called and nothing is stored', async () => {
      const { conector, llamadas } = conectorGuionizado('a', {}, { permiso: 'pendiente' });
      const { deps, guardados } = entorno([conector]);

      const informe = await ejecutarRefresco(plan({ a: ['p1', 'p2'] }), deps);

      expect(llamadas).toEqual([]);
      expect(guardados).toEqual([]);
      expect(informe.porCadena[0]).toMatchObject({ estado: 'sin-permiso', observaciones: 0, aplazadas: 2 });
    });

    test('a runnable permission with no cited reference counts as not permitted', async () => {
      const { conector, llamadas } = conectorGuionizado('a', {}, { permiso: 'riesgo-aceptado', permisoRef: '  ' });
      const informe = await ejecutarRefresco(plan({ a: ['p1'] }), entorno([conector]).deps);
      expect(llamadas).toEqual([]);
      expect(informe.porCadena[0].estado).toBe('sin-permiso');
    });

    test('a rejected chain does not run either', async () => {
      const { conector, llamadas } = conectorGuionizado('a', {}, { permiso: 'rechazado' });
      const informe = await ejecutarRefresco(plan({ a: ['p1'] }), entorno([conector]).deps);
      expect(llamadas).toEqual([]);
      expect(informe.porCadena[0].estado).toBe('sin-permiso');
    });

    test('a chain with no registered connector is reported, not fetched', async () => {
      const informe = await ejecutarRefresco(plan({ desconocida: ['p1'] }), entorno([]).deps);
      expect(informe.porCadena[0]).toMatchObject({ cadena: 'desconocida', estado: 'sin-conector', aplazadas: 1 });
    });

    test('a blocked-by-permission chain does not stop a permitted one', async () => {
      const bloqueada = conectorGuionizado('a', {}, { permiso: 'pendiente' });
      const permitida = conectorGuionizado('b', {});
      const { deps, guardados } = entorno([bloqueada.conector, permitida.conector]);

      const informe = await ejecutarRefresco(plan({ a: ['p1'], b: ['p1'] }), deps);

      expect(guardados).toEqual(['b:p1']);
      expect(informe.porCadena.map(r => r.estado)).toEqual(['sin-permiso', 'completada']);
    });
  });

  describe('when a chain refuses us', () => {
    test('BloqueoError stops that chain for the run, counting what was left, and leaves the others alone', async () => {
      const bloqueo = conectorGuionizado('a', { p2: [new BloqueoError('a')] });
      const otra = conectorGuionizado('b', {});
      const { deps, guardados } = entorno([bloqueo.conector, otra.conector]);

      const informe = await ejecutarRefresco(plan({ a: ['p1', 'p2', 'p3', 'p4'], b: ['q1', 'q2'] }), deps);

      expect(bloqueo.llamadas).toEqual(['p1', 'p2']);
      expect(guardados).toEqual(['a:p1', 'b:q1', 'b:q2']);
      expect(informe.porCadena[0]).toMatchObject({ estado: 'cortada-por-bloqueo', observaciones: 1, aplazadas: 3 });
      expect(informe.porCadena[1]).toMatchObject({ estado: 'completada', observaciones: 2 });
    });

    test('a rate limit waits what the chain asked and retries in a batch cut to half of what is left', async () => {
      // p2 is limited once: 3 left (p2, p3, p4) -> retry batch of 2 (p2, p3); p4 waits for a later run.
      const { conector, llamadas } = conectorGuionizado('a', {
        p2: [new LimiteDeTasaError('a', 5000), producto('a', 'p2')],
      });
      const { deps, guardados, esperas } = entorno([conector]);

      const informe = await ejecutarRefresco(plan({ a: ['p1', 'p2', 'p3', 'p4'] }), deps);

      expect(llamadas).toEqual(['p1', 'p2', 'p2', 'p3']);
      expect(guardados).toEqual(['a:p1', 'a:p2', 'a:p3']);
      expect(esperas).toContain(5000);
      expect(informe.porCadena[0]).toMatchObject({
        estado: 'completada',
        observaciones: 3,
        esperasPorLimite: 1,
        aplazadas: 1,
      });
    });

    test('a second rate limit on the request being retried alone gives up on the chain', async () => {
      const { conector, llamadas } = conectorGuionizado('a', { p1: [new LimiteDeTasaError('a', 1000)] });
      const informe = await ejecutarRefresco(plan({ a: ['p1'] }), entorno([conector]).deps);

      expect(llamadas).toEqual(['p1', 'p1']);
      expect(informe.porCadena[0]).toMatchObject({ estado: 'cortada-por-limite', esperasPorLimite: 2, aplazadas: 1 });
    });

    test('a rate limit that keeps coming still ends: the batch shrinks to one and the chain is dropped', async () => {
      const { conector, llamadas } = conectorGuionizado('a', { p1: [new LimiteDeTasaError('a', 100)] });
      const informe = await ejecutarRefresco(plan({ a: ['p1', 'p2', 'p3', 'p4', 'p5'] }), entorno([conector]).deps);

      expect(informe.porCadena[0].estado).toBe('cortada-por-limite');
      expect(llamadas.length).toBeLessThan(10);
    });
  });

  describe('one request going wrong', () => {
    test('an unexpected error fails that request only', async () => {
      const { conector } = conectorGuionizado('a', { p2: [new Error('boom')] });
      const { deps, guardados } = entorno([conector]);

      const informe = await ejecutarRefresco(plan({ a: ['p1', 'p2', 'p3'] }), deps);

      expect(guardados).toEqual(['a:p1', 'a:p3']);
      expect(informe.porCadena[0]).toMatchObject({ estado: 'completada', observaciones: 2, fallos: 1 });
    });

    test('a product the chain no longer has is counted, not stored', async () => {
      const { conector } = conectorGuionizado('a', { p1: [null] });
      const { deps, guardados } = entorno([conector]);

      const informe = await ejecutarRefresco(plan({ a: ['p1'] }), deps);

      expect(guardados).toEqual([]);
      expect(informe.porCadena[0]).toMatchObject({ sinDatos: 1, observaciones: 0 });
    });

    test('a failing store counts as a failure and the loop goes on', async () => {
      const { conector } = conectorGuionizado('a', {});
      const { deps } = entorno([conector]);
      let primera = true;
      const guardar = async () => {
        if (primera) {
          primera = false;
          throw new Error('db down');
        }
      };

      const informe = await ejecutarRefresco(plan({ a: ['p1', 'p2'] }), { ...deps, guardar });

      expect(informe.porCadena[0]).toMatchObject({ observaciones: 1, fallos: 1 });
    });
  });
});
