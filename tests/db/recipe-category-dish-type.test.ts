/**
 * FRESCO-881 — the category and the dish type of the reviewed families fit each other in every
 * database, not only the one the data migration ran on (CI builds the database with migrations
 * first and `seed.sql` after, so a correction that lives only in a migration is overwritten by
 * the seed).
 *
 * Runs only when `RUN_DB_INTEGRATION=1` AND the local Supabase stack answers —
 * `bun run test:db`. A bare `bun test` skips the whole file.
 */

import { describe, expect, test } from 'bun:test';
import { restAll, stackReachable } from './harness';

const RUN = process.env.RUN_DB_INTEGRATION === '1';
const reachable = RUN ? await stackReachable() : false;

interface Row {
  nombre: string
  clasificacion: { categoria?: string, tipo_plato?: string }
  ingredientes_principales: string[] | null
}

const SWEET_BATTERS = /^(?:Bizcocho casero de yogur|Creps de|Panqueques|Tortitas|Torrijas)/;
const OPEN_TOASTS = /^(?:Tostada con|Tostada de|Tostada integral|Tostas|Aguacate machacado|Pan con tomate)/;
const EGG_STYLE_SCRAMBLES = /^(?:Revuelto de cúrcuma|Tofu revuelto)/;

describe.skipIf(!(RUN && reachable))('category fits dish type in the reviewed families (real DB)', () => {
  async function activeRecipes() {
    const rows = await restAll<Row & { activo: boolean }>('recipes', {
      serviceRole: true,
      select: 'nombre,activo,clasificacion,ingredientes_principales',
      order: 'id',
    });
    return rows.filter(r => r.activo);
  }

  test('only the sweet roasted sweet potato is a vegetable dish for breakfast', async () => {
    const offenders = (await activeRecipes())
      .filter(r => r.clasificacion.categoria === 'verdura' && r.clasificacion.tipo_plato === 'desayuno')
      .map(r => r.nombre);

    expect(offenders).toEqual(['Boniato asado con canela y nueces']);
  });

  test('no salad is a breakfast dish', async () => {
    const offenders = (await activeRecipes())
      .filter(r => r.clasificacion.categoria === 'ensalada' && r.clasificacion.tipo_plato === 'desayuno')
      .map(r => r.nombre);

    expect(offenders).toEqual([]);
  });

  test('a recipe filed as huevos has eggs or is an egg-style scramble', async () => {
    const offenders = (await activeRecipes())
      .filter(r => r.clasificacion.categoria === 'huevos')
      .filter(r => !(r.ingredientes_principales ?? []).some(i => /huevo/i.test(i)) && !EGG_STYLE_SCRAMBLES.test(r.nombre))
      .map(r => r.nombre);

    expect(offenders).toEqual([]);
  });

  test('batters, toasts and wraps are not filed as sandwich', async () => {
    const offenders = (await activeRecipes())
      .filter(r => r.clasificacion.categoria === 'sandwich')
      .filter(r => SWEET_BATTERS.test(r.nombre) || OPEN_TOASTS.test(r.nombre) || r.nombre.startsWith('Wrap'))
      .map(r => r.nombre);

    expect(offenders).toEqual([]);
  });

  test('poke bowls are filed as bowls', async () => {
    const offenders = (await activeRecipes())
      .filter(r => r.nombre.startsWith('Poke bowl') && r.clasificacion.categoria !== 'bowls')
      .map(r => r.nombre);

    expect(offenders).toEqual([]);
  });
});
