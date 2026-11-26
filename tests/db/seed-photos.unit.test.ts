/**
 * FRESCO-1318/QAFRESCO-30 — the local stack and CI are built from `supabase/seed.sql`, so a photo that
 * contradicts a recipe stays visible there even after the hosted row is fixed. These two were checked by
 * eye on 2026-11-26: the seed showed boiled eggs on an egg-free salad and prawns on a vegan soup.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';

const SEED = readFileSync(join(import.meta.dir, '../../supabase/seed.sql'), 'utf8').split('\n');
const BUCKET = 'https://jdqemhewjrjuopssdurn.supabase.co/storage/v1/object/public/recipe-photos';

describe('reviewed recipe photos in the seed', () => {
  test.each([
    ['Ensalada de kale con manzana', 'c2c90c31-d0f0-4075-a5cc-661fb864ec09'],
    ['Crema de calabacín', '4861222e-eee8-41ce-becd-74e5ed969247'],
  ])('"%s" points at the reviewed hosted photo', (name, id) => {
    const rows = SEED.filter(line => line.startsWith(`\t('${id}', `));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain(`, '${name}', `);
    expect(rows[0].match(/'https:\/\/[^']+'/g)).toEqual([`'${BUCKET}/${id}.jpg'`]);
  });
});
