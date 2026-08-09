// FRESCO-145 — Food.com recipe dataset migration, data quality contract.
// Runs against the LIVE `recipes` table (read-only REST, same
// NEXT_PUBLIC_SUPABASE_URL/ANON_KEY pattern as the other pipeline scripts),
// not fixtures — this is a data-quality gate, not a unit test. Per the
// design spec: run green against the pre-migration table FIRST (proves the
// suite itself is correct before it's used to gate Task 10's batch inserts),
// then re-run after every batch.

import { describe, expect, test } from 'bun:test';
import { ALERGENOS_VOCAB, DIETA_KEYS } from './foodcom-recipe-taxonomy';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface RecipeRow {
  id: string
  nombre: string
  slug: string
  ingredientes_principales: string[] | null
  dieta: Record<string, boolean> | null
  alergenos: string[] | null
  source: { provider: string, dataset: string, dataset_publisher: string, source_recipe_id: string, declared_license: string } | null
}

async function fetchAllRecipes(): Promise<RecipeRow[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/recipes?select=id,nombre,slug,ingredientes_principales,dieta,alergenos,source`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
  );
  if (!res.ok) { throw new Error(`Failed to fetch recipes: ${res.status} ${await res.text()}`); }
  return await res.json() as RecipeRow[];
}

const RECIPE_SOURCE_FIELDS = ['provider', 'dataset', 'dataset_publisher', 'source_recipe_id', 'declared_license'] as const;

describe('RecipeDataContract (live recipes table)', () => {
  test('source is either null or has all 5 fields populated — no partial provenance', async () => {
    const recipes = await fetchAllRecipes();
    const partial = recipes.filter((r) => {
      const source = r.source;
      if (source === null) { return false; }
      return RECIPE_SOURCE_FIELDS.some(field => !source[field]);
    });
    expect(partial.map(r => r.id)).toEqual([]);
  });

  test('nombre is non-empty for every recipe', async () => {
    const recipes = await fetchAllRecipes();
    const empty = recipes.filter(r => !r.nombre || r.nombre.trim().length === 0);
    expect(empty.map(r => r.id)).toEqual([]);
  });

  test('ingredientes_principales has at least one entry for every recipe', async () => {
    const recipes = await fetchAllRecipes();
    const missing = recipes.filter(r => !r.ingredientes_principales || r.ingredientes_principales.length === 0);
    expect(missing.map(r => r.id)).toEqual([]);
  });

  test('no duplicate slug across the table', async () => {
    const recipes = await fetchAllRecipes();
    const seen = new Map<string, string[]>();
    for (const r of recipes) {
      seen.set(r.slug, [...(seen.get(r.slug) ?? []), r.id]);
    }
    const duplicates = [...seen.entries()].filter(([, ids]) => ids.length > 1);
    expect(duplicates).toEqual([]);
  });

  test('alergenos values are drawn only from the known live vocabulary', async () => {
    const recipes = await fetchAllRecipes();
    const known = new Set<string>(ALERGENOS_VOCAB);
    const violations = recipes.flatMap(r =>
      (r.alergenos ?? []).filter(a => !known.has(a)).map(a => `${r.id}: ${a}`));
    expect(violations).toEqual([]);
  });

  test('dieta, when present, has exactly the known 10 boolean keys', async () => {
    const recipes = await fetchAllRecipes();
    const knownKeys = new Set<string>(DIETA_KEYS);
    const violations: string[] = [];
    for (const r of recipes) {
      if (!r.dieta) { continue; }
      const keys = Object.keys(r.dieta);
      const unknown = keys.filter(k => !knownKeys.has(k));
      const missing = DIETA_KEYS.filter(k => !(k in r.dieta!));
      const nonBoolean = keys.filter(k => typeof r.dieta![k] !== 'boolean');
      if (unknown.length > 0 || missing.length > 0 || nonBoolean.length > 0) {
        violations.push(`${r.id}: unknown=[${unknown.join(',')}] missing=[${missing.join(',')}] nonBoolean=[${nonBoolean.join(',')}]`);
      }
    }
    expect(violations).toEqual([]);
  });
});
