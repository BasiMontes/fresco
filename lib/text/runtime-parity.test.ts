import { describe, expect, test } from 'bun:test';
import { normalizeNombre as normalizeNombreEdge } from '../../supabase/functions/_shared/normalize';
import { getCurrentIsoWeek } from '../../supabase/functions/send-weekly-reengagement-push/iso-week';
import { getIsoWeek } from '../date/iso-week';
import { normalizeNombre as normalizeNombreWeb } from './normalize-nombre';

/**
 * FRESCO-382 (audit-4 A4-M8): a handful of pure helpers are duplicated across
 * the Node runtime and the Deno Edge Functions because the Edge bundler does
 * not resolve value imports reaching outside `supabase/functions/`. Nothing at
 * the type level forces the copies to stay identical. This test does: it runs
 * each copy against a shared corpus and fails the moment their outputs drift.
 *
 * When a copy legitimately changes, update BOTH sides and extend the corpus.
 */

const NOMBRE_CORPUS = [
  'Tomate',
  '  Brócoli   Fresco ',
  'JAMÓN Serrano',
  'piñón',
  'AÑEJO ñoño',
  'Café con Leche',
  'àèìòù ÁÉÍÓÚ äëïöü',
  'espárragos trigueros',
  'tabulé de quinoa',
  '',
  '   ',
  'sal',
  'Aceite\tde\noliva',
];

const ISO_WEEK_CORPUS = [
  '2026-01-01', // week 1 boundary
  '2025-12-31', // ISO week-year differs from calendar year
  '2027-01-01', // Friday -> still week 53 of 2026
  '2024-12-30', // Monday of an ISO week that spans the year
  '2026-03-29', // European DST spring-forward
  '2026-10-25', // European DST fall-back
  '2026-06-15',
  '2028-01-03', // leap year, week 1
  '2020-02-29', // leap day
];

describe('runtime parity — normalizeNombre (Node lib/text vs Deno _shared)', () => {
  test.each(NOMBRE_CORPUS)('produces identical output for %j', (input) => {
    expect(normalizeNombreWeb(input)).toBe(normalizeNombreEdge(input));
  });
});

describe('runtime parity — ISO week (Node lib/date getIsoWeek vs Deno getCurrentIsoWeek)', () => {
  test.each(ISO_WEEK_CORPUS)('produces identical week string for %s', (isoDate) => {
    const date = new Date(`${isoDate}T12:00:00`);
    expect(getIsoWeek(date)).toBe(getCurrentIsoWeek(date));
  });
});
