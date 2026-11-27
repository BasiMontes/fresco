/**
 * FRESCO-1323 — the cream with fresh cheese was renamed in FRESCO-1317 and kept a description that promised spices
 * it does not have, without its accent. The local stack and CI are built from `supabase/seed.sql`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';

const SEED = readFileSync(join(import.meta.dir, '../../supabase/seed.sql'), 'utf8').split('\n');
const ID = '154f8b38-3815-4f7a-a765-8af1ee20d774';

describe('reviewed recipe descriptions in the seed', () => {
  test('"Crema de calabacín con queso fresco" describes what it contains', () => {
    const rows = SEED.filter(line => line.startsWith(`\t('${ID}', `));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain(', \'Crema de calabacín con queso fresco\', \'crema-de-calabacin-con-especias-version-ligera\', \'Crema suave de calabacín y puerro con queso fresco.\', ');
  });
});
