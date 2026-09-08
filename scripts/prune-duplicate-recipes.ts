#!/usr/bin/env bun

// FRESCO-460 — execute the near-duplicate prune planned in FRESCO-453.
//
// Clusters `recipes` by cleaned `nombre` (scripts/clean-recipe-names.ts's
// cleanRecipeName, FRESCO-449) + normalized ingredientes_principales. Within
// each cluster of size > 1, keeps one representative (has foto_url > higher
// veces_cocinada+veces_calificada > oldest) and soft-deletes the rest via
// `recipes.activo = false` (FRESCO-460 migration) — never a hard DELETE:
// meal_plan_recipes.recipe_id is ON DELETE RESTRICT and historical meal-plan
// rows must keep resolving.
//
// Deliberately recomputes clusters live every run instead of reading a
// stored id list — the ticket's own risk note: catalog data can change
// between planning and execution, so a stale id list must never be trusted.
//
// Usage:
//   bun scripts/prune-duplicate-recipes.ts              # dry-run, logs clusters + summary
//   bun scripts/prune-duplicate-recipes.ts --apply       # writes activo=false via service_role

import { cleanRecipeName } from './clean-recipe-names.ts';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');
const PAGE_SIZE = 500;

interface RecipeRow {
  id: string
  nombre: string
  ingredientes_principales: string[] | null
  foto_url: string | null
  veces_cocinada: number | null
  veces_calificada: number | null
  created_at: string
}

async function fetchAllRecipes(): Promise<RecipeRow[]> {
  const all: RecipeRow[] = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/recipes?select=id,nombre,ingredientes_principales,foto_url,veces_cocinada,veces_calificada,created_at&order=id&offset=${offset}&limit=${PAGE_SIZE}`,
      { headers: { apikey: SERVICE_ROLE_KEY!, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
    );
    if (!res.ok) {
      throw new Error(`Fetch failed (offset=${offset}): ${res.status} ${await res.text()}`);
    }
    const page = (await res.json()) as RecipeRow[];
    all.push(...page);
    if (page.length < PAGE_SIZE) { break; }
    offset += PAGE_SIZE;
  }
  return all;
}

function normalizeIngredients(list: string[] | null): string {
  if (!list || list.length === 0) { return ''; }
  return [...new Set(list.map(s => s.trim().toLowerCase()))].sort().join('|');
}

function clusterKey(r: RecipeRow): string {
  return `${cleanRecipeName(r.nombre).toLowerCase()}::${normalizeIngredients(r.ingredientes_principales)}`;
}

/** has photo > higher (veces_cocinada + veces_calificada) signal > oldest. */
function pickRepresentative(cluster: RecipeRow[]): RecipeRow {
  return [...cluster].sort((a, b) => {
    const aPhoto = a.foto_url ? 1 : 0;
    const bPhoto = b.foto_url ? 1 : 0;
    if (aPhoto !== bPhoto) { return bPhoto - aPhoto; }
    const aSignal = (a.veces_cocinada ?? 0) + (a.veces_calificada ?? 0);
    const bSignal = (b.veces_cocinada ?? 0) + (b.veces_calificada ?? 0);
    if (aSignal !== bSignal) { return bSignal - aSignal; }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  })[0];
}

async function applyPrune(id: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/recipes?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SERVICE_ROLE_KEY!,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ activo: false }),
  });
  if (!res.ok) {
    throw new Error(`Prune failed for id=${id}: ${res.status} ${await res.text()}`);
  }
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY in env.');
    process.exit(1);
  }

  console.error(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  const recipes = await fetchAllRecipes();
  console.error(`Fetched ${recipes.length} recipes.`);

  const clusters = new Map<string, RecipeRow[]>();
  for (const r of recipes) {
    const key = clusterKey(r);
    const arr = clusters.get(key) ?? [];
    arr.push(r);
    clusters.set(key, arr);
  }

  const dupClusters = [...clusters.values()].filter(c => c.length > 1);
  const pruneCandidates: RecipeRow[] = [];
  for (const cluster of dupClusters) {
    const rep = pickRepresentative(cluster);
    for (const r of cluster) {
      if (r.id === rep.id) { continue; }
      pruneCandidates.push(r);
      console.log(`${r.id} | ${r.nombre} (prune, keeping ${rep.id})`);
    }
  }

  console.error(`Duplicate clusters (>1 member): ${dupClusters.length}`);
  console.error(`Prune candidates: ${pruneCandidates.length}`);
  console.error(`Final active catalog would be: ${recipes.length - pruneCandidates.length}`);

  if (APPLY) {
    for (const r of pruneCandidates) {
      await applyPrune(r.id);
    }
    console.error(`Applied activo=false to ${pruneCandidates.length} recipes.`);
  }
  else {
    console.error('Dry-run only — pass --apply to write.');
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
