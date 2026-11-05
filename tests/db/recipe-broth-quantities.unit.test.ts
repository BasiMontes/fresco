import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

/**
 * FRESCO-1123 (A8-SAFEB-05) — a recipe that lists "caldo de verduras" in `ingredientes_principales`
 * must carry it in `ingredientes_cantidades` too, or scaling and the shopping list lose the stock
 * (the `apio` source). Runs on the committed seed catalogue, no stack needed; the hosted rows are
 * fixed by `20261105100000_recipe_broth_audit8.sql` and checked by `recipe-stock-and-miso-rules.test.ts`
 * (`bun run test:db`).
 */

const seed = readFileSync(new URL('../../supabase/seed.sql', import.meta.url), 'utf8').split('\n');

interface SeedRecipe { slug: string, hasStockListed: boolean, quantities: { nombre: string, unidad: string, cantidad: number }[] }

const recipes: SeedRecipe[] = seed.flatMap((line) => {
  const m = line.match(/'(\[\{.*\}\])'\)[,;]$/);
  if (!m || m.index === undefined) {
    return [];
  }
  return [{
    slug: line.match(/'([a-z0-9-]+)', '/)?.[1] ?? line.slice(0, 60),
    hasStockListed: line.slice(0, m.index).includes('"caldo de verduras"'),
    quantities: JSON.parse(m[1]),
  }];
});

describe('seed catalogue: vegetable stock in the quantities', () => {
  test('the seed has recipes with quantities and with a listed stock (the check is not vacuous)', () => {
    expect(recipes.length).toBeGreaterThan(50);
    expect(recipes.filter(r => r.hasStockListed).length).toBeGreaterThanOrEqual(20);
  });

  test('every recipe that lists a vegetable stock carries it in ingredientes_cantidades', () => {
    const missing = recipes
      .filter(r => r.hasStockListed && !r.quantities.some(q => /\bcaldo\b/.test(q.nombre.toLowerCase())))
      .map(r => r.slug);

    expect(missing).toEqual([]);
  });

  test('a stock row added without a stated amount is "al gusto", never an invented quantity', () => {
    const stockRows = recipes.flatMap(r => r.quantities.filter(q => q.nombre === 'caldo de verduras' && q.unidad === 'al gusto'));

    expect(stockRows.length).toBeGreaterThanOrEqual(20);
    expect(stockRows.every(q => q.cantidad === 0)).toBe(true);
  });
});
