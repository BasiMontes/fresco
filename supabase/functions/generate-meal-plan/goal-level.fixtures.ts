// FRESCO-1227: a realistic pool for the goal and cooking-level tests. It starts from the FRESCO-1226 pool (the live
// catalog's cuisine mix) and gives every recipe the other attributes the new terms read, with the catalog's real
// mix (counted from supabase/seed.sql, 1287 recipes): cost 240/571/271/205 (muy_bajo/bajo/medio/alto), difficulty
// 95/623/335/234 (muy_facil/facil/media/avanzada), es_ligero 510 true / 777 false, ~3.5 main ingredients per recipe
// drawn from the catalog's real most frequent ingredients plus a long tail.
import type { Recipe } from './types.ts'
import { buildRealisticPool } from './favourite-cuisines.fixtures.ts'

/** Tiny seeded PRNG: the fixture is deterministic. */
function lcg(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0
    return a / 4294967296
  }
}

function weighted<T>(draw: number, table: [T, number][]): T {
  const total = table.reduce((sum, [, n]) => sum + n, 0)
  let acc = draw * total
  for (const [value, n] of table) {
    acc -= n
    if (acc < 0) return value
  }
  return table[table.length - 1][0]
}

const COSTE: [string, number][] = [['muy_bajo', 240], ['bajo', 571], ['medio', 271], ['alto', 205]]
const DIFICULTAD: [string, number][] = [['muy_facil', 95], ['facil', 623], ['media', 335], ['avanzada', 234]]
// Real counts from the seed: the head of the ingredient distribution (staples included) ...
const HEAD: [string, number][] = [
  ['tomate', 215], ['ajo', 191], ['cebolla', 177], ['huevo', 140], ['aceite de oliva', 136], ['pan integral', 105],
  ['pimiento', 103], ['zanahoria', 95], ['aguacate', 88], ['patata', 85], ['espinacas', 80], ['arroz', 73],
  ['limón', 72], ['leche', 70], ['brócoli', 64], ['pechuga de pollo', 64], ['queso rallado', 60], ['tofu', 59],
  ['jengibre', 58], ['champiñones', 55], ['aceitunas', 52], ['calabacín', 52], ['salmón', 50], ['plátano', 49],
  ['frutos rojos', 49], ['cilantro', 48], ['avena', 47], ['lima', 46], ['queso fresco', 46], ['pan', 46],
]
// ... and a long tail of 246 synthetic ingredients so about half of the draws come from outside the head (the real catalog has 276 distinct ingredients).
const TAIL: [string, number][] = Array.from({ length: 246 }, (_, k) => [`ingrediente-${k}`, 1])
const INGREDIENTS: [string, number][] = [...HEAD, ...TAIL.map(([name]): [string, number] => [name, 12])]

/** The FRESCO-1226 pool with the catalog's real cost, difficulty, lightness and ingredient mix. Deterministic. */
export function buildGoalLevelPool(perTipo = 120): Recipe[] {
  const rng = lcg(20261118)
  return buildRealisticPool(perTipo).map((recipe) => {
    const ingredients = new Set<string>()
    const wanted = rng() < 0.5 ? 3 : 4
    while (ingredients.size < wanted) ingredients.add(weighted(rng(), INGREDIENTS))
    return {
      ...recipe,
      meta: { ...recipe.meta!, coste_estimado: weighted(rng(), COSTE) as never, dificultad: weighted(rng(), DIFICULTAD) as never },
      clasificacion: { ...recipe.clasificacion!, es_ligero: rng() < 510 / 1287 },
      ingredientes_principales: [...ingredients],
    }
  })
}
