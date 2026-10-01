import type { ObservacionDePrecio } from './price-write';
import { describe, expect, test } from 'bun:test';
import { decidirEscritura } from './price-write';

function obs(extra: Partial<ObservacionDePrecio> = {}): ObservacionDePrecio {
  return { precioEnvase: 2.5, disponible: true, observadoEn: '2026-10-01T10:00:00.000Z', ...extra };
}

describe('decidirEscritura', () => {
  test('a first observation is written and recorded in the history', () => {
    expect(decidirEscritura(null, obs())).toBe('actualizar-con-historial');
  });

  test('a changed price is written and recorded in the history', () => {
    const actual = obs({ observadoEn: '2026-09-24T10:00:00.000Z' });
    expect(decidirEscritura(actual, obs({ precioEnvase: 2.6 }))).toBe('actualizar-con-historial');
  });

  test('a changed availability is written and recorded in the history', () => {
    const actual = obs({ observadoEn: '2026-09-24T10:00:00.000Z' });
    expect(decidirEscritura(actual, obs({ disponible: false }))).toBe('actualizar-con-historial');
  });

  test('the same price and availability only move the date forward', () => {
    const actual = obs({ observadoEn: '2026-09-24T10:00:00.000Z' });
    expect(decidirEscritura(actual, obs())).toBe('actualizar');
  });

  test('prices are compared in cents, so float noise is not a change', () => {
    const actual = obs({ precioEnvase: 0.3, observadoEn: '2026-09-24T10:00:00.000Z' });
    expect(decidirEscritura(actual, obs({ precioEnvase: 0.1 + 0.2 }))).toBe('actualizar');
  });

  test('an observation that is not newer is ignored, even if the price differs', () => {
    expect(decidirEscritura(obs(), obs({ precioEnvase: 9 }))).toBe('ignorar');
    expect(decidirEscritura(obs(), obs({ precioEnvase: 9, observadoEn: '2026-09-01T00:00:00.000Z' }))).toBe('ignorar');
  });

  test('an unusable date or price is never written, even as a first observation', () => {
    expect(decidirEscritura(null, obs({ observadoEn: 'ayer' }))).toBe('ignorar');
    expect(decidirEscritura(null, obs({ precioEnvase: 0 }))).toBe('ignorar');
    expect(decidirEscritura(null, obs({ precioEnvase: Number.NaN }))).toBe('ignorar');
  });

  test('a stored row with an unreadable date is treated as stale and overwritten', () => {
    const actual = obs({ observadoEn: 'roto' });
    expect(decidirEscritura(actual, obs())).toBe('actualizar');
  });
});
