#!/usr/bin/env bun

// FRESCO-525 — execute the near-duplicate merges analyzed in FRESCO-522/525.
//
// Unlike scripts/prune-duplicate-recipes.ts (FRESCO-460, which prunes rows
// that already collapse to the same cleaned name + identical ingredients),
// this script handles a narrower, human-reviewed set of pairs whose *names*
// differ (connector word "con"/"y", or an accent) but whose
// `ingredientes_principales` were confirmed identical by hand — see the full
// case-by-case analysis + canonical-selection rationale in
// `.context/audits/2026-09-17-FRESCO-525-near-duplicate-recipe-review/README.md`.
//
// This ticket is explicitly "no automatizable a ciegas" (not blindly
// automatable): 7 of the 11 reviewed groups were NOT merged because their
// ingredients differ — see the analysis doc. Do NOT extend MERGE_PAIRS below
// without the same manual ingredient comparison.
//
// For each pair, in order:
//   1. Redirect meal_plan_recipes.recipe_id -> canonical id.
//   2. Redirect favorites.recipe_id -> canonical id, EXCEPT where the same
//      user already favorited the canonical recipe (favorites has a
//      UNIQUE(user_id, recipe_id) constraint) — in that case the now-redundant
//      duplicate favorite row is deleted instead of redirected, to avoid a
//      23505 conflict.
//   3. Deactivate the duplicate recipe (`activo = false`). Never a hard
//      DELETE: meal_plan_recipes.recipe_id is ON DELETE RESTRICT and
//      historical meal-plan rows must keep resolving (same rationale as
//      supabase/migrations/20260908180000_recipes_activo_soft_delete.sql).
//
// Reference counts are always fetched live at run time, never trusted from
// the analysis doc's snapshot — usage data changes between planning and
// execution (same rationale as prune-duplicate-recipes.ts).
//
// Usage:
//   bun scripts/merge-near-duplicate-recipes.ts              # dry-run, logs every planned change
//   bun scripts/merge-near-duplicate-recipes.ts --apply       # writes via service_role
//
// CRITICAL: this ticket's own scope explicitly excludes running --apply.
// The dry-run output requires human sign-off on the canonical-selection
// rule (see analysis doc "Flags" section, item 1 and 5) before anyone runs
// --apply against production data.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');

interface MergePair {
  group: string
  canonicalId: string
  canonicalNombre: string
  duplicateId: string
  duplicateNombre: string
}

// Hardcoded, human-reviewed pairs — see the analysis doc for the full
// ingredient comparison and canonical-selection rationale per pair.
const MERGE_PAIRS: MergePair[] = [
  {
    group: 'Batido verde + frutos rojos',
    canonicalId: '71bd98eb-8f99-4cb9-996e-622471e0e694',
    canonicalNombre: 'Batido verde con frutos rojos',
    duplicateId: '92598a37-b83f-4c22-921a-2d71c797125d',
    duplicateNombre: 'Batido verde frutos rojos',
  },
  {
    group: 'Batido verde + miel',
    canonicalId: 'f87aa7ce-aa3e-45ff-b6a9-f152404e61a0',
    canonicalNombre: 'Batido verde miel',
    duplicateId: 'a8edf55f-21da-4269-a3d6-a248d6d4e50c',
    duplicateNombre: 'Batido verde con miel',
  },
  {
    group: 'Batido verde + canela',
    canonicalId: 'd67259a9-89a5-4aaa-95dc-a5e3f68806a8',
    canonicalNombre: 'Batido verde con canela',
    duplicateId: 'd806c307-1c2f-4c4a-b30c-cf15ce75c256',
    duplicateNombre: 'Batido verde canela',
  },
  {
    group: 'Sopa de tomate + albahaca',
    canonicalId: '1b85af10-6641-4cf8-b68a-425a37575391',
    canonicalNombre: 'Sopa de tomate y albahaca',
    duplicateId: 'ca33bf14-c5c9-4d20-90fd-5ab141d0515b',
    duplicateNombre: 'Sopa de tomate con albahaca',
  },
];

interface FavoriteRow {
  id: string
  user_id: string
  recipe_id: string
}

interface MealPlanRecipeRow {
  id: string
  meal_plan_id: string
  recipe_id: string
}

function headers(): HeadersInit {
  return {
    'apikey': SERVICE_ROLE_KEY!,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  };
}

// `service_role` currently lacks a table-level SELECT grant on `favorites`
// and `meal_plan_recipes` via PostgREST (confirmed live: 403 42501, "Grant
// the required privileges to the current role with: GRANT SELECT ON
// public.<table> TO service_role" — `recipes` itself has the grant and
// reads fine). This is a genuine infra gap, not a bug in this script: it
// blocks the redirect step for BOTH dry-run reads and any future --apply
// write. Treated as non-fatal here so dry-run still reports every pair; see
// the analysis doc's "Flags" section for the human decision this needs
// (grant the privilege via a migration, or redirect through a path that
// doesn't go through PostgREST) before anyone runs --apply.
class GrantMissingError extends Error {}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { apikey: SERVICE_ROLE_KEY!, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } });
  if (res.status === 403) {
    const body = await res.text();
    throw new GrantMissingError(`403 permission denied: ${body}`);
  }
  if (!res.ok) { throw new Error(`Fetch failed: ${res.status} ${await res.text()}`); }
  return (await res.json()) as T;
}

async function fetchFavorites(recipeId: string): Promise<FavoriteRow[]> {
  return fetchJson<FavoriteRow[]>(`${SUPABASE_URL}/rest/v1/favorites?select=id,user_id,recipe_id&recipe_id=eq.${recipeId}`);
}

async function fetchCanonicalFavoriteUserIds(canonicalId: string): Promise<Set<string>> {
  const rows = await fetchJson<{ user_id: string }[]>(`${SUPABASE_URL}/rest/v1/favorites?select=user_id&recipe_id=eq.${canonicalId}`);
  return new Set(rows.map(r => r.user_id));
}

async function fetchMealPlanRecipes(recipeId: string): Promise<MealPlanRecipeRow[]> {
  return fetchJson<MealPlanRecipeRow[]>(`${SUPABASE_URL}/rest/v1/meal_plan_recipes?select=id,meal_plan_id,recipe_id&recipe_id=eq.${recipeId}`);
}

async function redirectMealPlanRecipe(id: string, canonicalId: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/meal_plan_recipes?id=eq.${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ recipe_id: canonicalId }),
  });
  if (!res.ok) { throw new Error(`Redirect meal_plan_recipes id=${id} failed: ${res.status} ${await res.text()}`); }
}

async function redirectFavorite(id: string, canonicalId: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/favorites?id=eq.${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ recipe_id: canonicalId }),
  });
  if (!res.ok) { throw new Error(`Redirect favorites id=${id} failed: ${res.status} ${await res.text()}`); }
}

async function deleteFavorite(id: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/favorites?id=eq.${id}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok) { throw new Error(`Delete redundant favorite id=${id} failed: ${res.status} ${await res.text()}`); }
}

async function deactivateRecipe(id: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/recipes?id=eq.${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ activo: false }),
  });
  if (!res.ok) { throw new Error(`Deactivate recipe id=${id} failed: ${res.status} ${await res.text()}`); }
}

async function processPair(pair: MergePair): Promise<void> {
  console.log(`\n=== ${pair.group} ===`);
  console.log(`Canonical: ${pair.canonicalId} | ${pair.canonicalNombre}`);
  console.log(`Duplicate: ${pair.duplicateId} | ${pair.duplicateNombre} (would be deactivated)`);

  let redirectsBlocked = false;

  try {
    const mealPlanRows = await fetchMealPlanRecipes(pair.duplicateId);
    for (const row of mealPlanRows) {
      console.log(`  meal_plan_recipes ${row.id} (meal_plan_id=${row.meal_plan_id}) | recipe_id ${pair.duplicateId} -> ${pair.canonicalId}`);
      if (APPLY) { await redirectMealPlanRecipe(row.id, pair.canonicalId); }
    }
    if (mealPlanRows.length === 0) { console.log('  meal_plan_recipes: no live references.'); }
  }
  catch (err) {
    if (!(err instanceof GrantMissingError)) { throw err; }
    redirectsBlocked = true;
    console.log(`  meal_plan_recipes: BLOCKED — service_role lacks SELECT grant on this table (${err.message}).`);
  }

  try {
    const favoriteRows = await fetchFavorites(pair.duplicateId);
    if (favoriteRows.length === 0) {
      console.log('  favorites: no live references.');
    }
    else {
      const canonicalFavoriteUserIds = await fetchCanonicalFavoriteUserIds(pair.canonicalId);
      for (const row of favoriteRows) {
        if (canonicalFavoriteUserIds.has(row.user_id)) {
          console.log(`  favorites ${row.id} (user_id=${row.user_id}) | already favorited canonical -> DELETE redundant row`);
          if (APPLY) { await deleteFavorite(row.id); }
        }
        else {
          console.log(`  favorites ${row.id} (user_id=${row.user_id}) | recipe_id ${pair.duplicateId} -> ${pair.canonicalId}`);
          if (APPLY) { await redirectFavorite(row.id, pair.canonicalId); }
        }
      }
    }
  }
  catch (err) {
    if (!(err instanceof GrantMissingError)) { throw err; }
    redirectsBlocked = true;
    console.log(`  favorites: BLOCKED — service_role lacks SELECT grant on this table (${err.message}).`);
  }

  if (redirectsBlocked) {
    console.log(`  recipes ${pair.duplicateId} | activo: true -> false — SKIPPED: reference redirect is blocked, deactivating now would orphan any live reference.`);
    if (APPLY) { throw new Error(`Refusing to deactivate ${pair.duplicateId}: reference redirect was blocked for this pair. Fix the service_role grant first.`); }
    return;
  }

  console.log(`  recipes ${pair.duplicateId} | activo: true -> false`);
  if (APPLY) { await deactivateRecipe(pair.duplicateId); }
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY in env.');
    process.exit(1);
  }

  console.error(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.error(`${MERGE_PAIRS.length} human-reviewed merge pairs (see analysis doc for the other 7 groups kept as-is).`);

  for (const pair of MERGE_PAIRS) {
    await processPair(pair);
  }

  console.error(`\n${MERGE_PAIRS.length} pairs processed.${APPLY ? ' Applied.' : ' Dry-run only — pass --apply to write.'}`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
