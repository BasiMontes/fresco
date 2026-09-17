#!/usr/bin/env bun

// FRESCO-526 — deterministic cleanup of `recipes.descripcion_corta`. The same
// offline combinatorial generator that left dangling connectors in `nombre`
// (FRESCO-449, `clean-recipe-names.ts`) left a narrower bug here: when the
// flavor-descriptor slot right after "de"/the dish's base clause was filled,
// the generator concatenated straight through without dropping the leftover
// "de", producing "<plato> de con <relleno> con <variante>, apta vegana...".
// Verified against all 62 affected prod rows (2026-09-15): the pattern is
// exactly one "de con" per row, always meant to read as "con" (the "de" is
// the leftover) — dropping it reads naturally in every sample ("Wok de con
// tamari" -> "Wok con tamari", "Sopa de con ajo" -> "Sopa con ajo").
//
// FRESCO-528 — collateral finding from FRESCO-526, same generator-template
// bug, different connector pair: the generator also left a duplicated
// connector "con y "/"de y " (e.g. "Tofu a la plancha con y limón con ajo
// asado..." -> "...con limón con ajo asado..."). Verified against the
// affected active rows (2026-09-17): collapsing "<con|de> y " to "<con|de> "
// reads naturally in every sample.
//
// Usage:
//   bun scripts/clean-recipe-descriptions.ts              # dry-run, logs id | before -> after
//   bun scripts/clean-recipe-descriptions.ts --apply       # writes changed rows via service_role

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');
const PAGE_SIZE = 500;

const DANGLING_DE_CON = /\bde con\b/gi;
const DUPLICATED_CONNECTOR = /\b(con|de)\s+y\s+/gi;

export function cleanRecipeDescription(original: string): string {
  return original
    .replace(DANGLING_DE_CON, 'con')
    .replace(DUPLICATED_CONNECTOR, '$1 ');
}

interface RecipeRow {
  id: string
  descripcion_corta: string
}

async function fetchAffectedRecipes(supabaseUrl: string, serviceRoleKey: string): Promise<RecipeRow[]> {
  const all: RecipeRow[] = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/recipes?select=id,descripcion_corta&or=(descripcion_corta.ilike.*de con*,descripcion_corta.ilike.*con y*,descripcion_corta.ilike.*de y*)&order=id&offset=${offset}&limit=${PAGE_SIZE}`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
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

async function applyUpdate(supabaseUrl: string, serviceRoleKey: string, id: string, descripcionCorta: string): Promise<void> {
  const res = await fetch(`${supabaseUrl}/rest/v1/recipes?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ descripcion_corta: descripcionCorta }),
  });
  if (!res.ok) {
    throw new Error(`Update failed for id=${id}: ${res.status} ${await res.text()}`);
  }
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY in env.');
    process.exit(1);
  }

  console.error(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  // The `or=(...)` ilike clauses are a coarse pre-filter (case-insensitive
  // substring, no word boundaries — PostgREST can't express `\y`/`\b` regex
  // directly) — cheaper than fetching every row. `cleanRecipeDescription`'s
  // word-boundary regexes are still the source of truth for what actually
  // changes: "*con y*"/"*de y*" also match unrelated words like "con yogur"
  // or "de yuca", but those pass through untouched since the JS regex
  // requires a standalone "y" token.
  const recipes = await fetchAffectedRecipes(SUPABASE_URL, SERVICE_ROLE_KEY);
  console.error(`Fetched ${recipes.length} candidate recipes.`);

  let changed = 0;
  for (const recipe of recipes) {
    const cleaned = cleanRecipeDescription(recipe.descripcion_corta);
    if (cleaned !== recipe.descripcion_corta) {
      changed++;
      console.log(`${recipe.id} | ${recipe.descripcion_corta} -> ${cleaned}`);
      if (APPLY) {
        await applyUpdate(SUPABASE_URL, SERVICE_ROLE_KEY, recipe.id, cleaned);
      }
    }
  }
  console.error(`${changed}/${recipes.length} descriptions changed.${APPLY ? ' Applied.' : ' Dry-run only — pass --apply to write.'}`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
