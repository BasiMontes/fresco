#!/usr/bin/env bun

// FRESCO-435 / FRESCO-1084 — builds AI-image-generation prompts for recipes
// missing a photo, straight from the recipe's own structured fields
// (nombre, ingredientes_principales, pasos_resumen).
//
// Prompts are English and positive-only (see scripts/photo-prompt-en.ts for
// why). The Spanish fields are translated through a fixed ingredient glossary;
// a recipe with an ingredient the glossary does not know is SKIPPED and
// reported on stderr, never guessed. Add the missing term to INGREDIENTS_EN
// and run again.
//
// Pipeline:
//   1. bun scripts/build-photo-prompts.ts [batchSize=20] > /tmp/prompts.json
//   2. bun scripts/generate-photos-cloudflare.ts /tmp/prompts.json ./generated-photos --apply
//   3. (review the images, vision-verify)
//   4. bun scripts/apply-photo-generations.ts /tmp/prompts.json ./generated-photos --apply
//
// Same `foto_url is null and activo = true` filter as fetch-recipe-photos.ts,
// so this never spends generation effort on soft-deleted catalog rows.

import { buildEnglishPrompt } from './photo-prompt-en.ts';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BATCH_SIZE = Number(process.argv[2] ?? 20);

interface RecipeRow {
  id: string
  nombre: string
  slug: string
  ingredientes_principales: string[]
  pasos_resumen: string[]
}

async function main() {
  // Over-fetch: recipes with an unknown ingredient are skipped, and the batch
  // should still come out full.
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/recipes?select=id,nombre,slug,ingredientes_principales,pasos_resumen&foto_url=is.null&activo=eq.true&order=id&limit=${BATCH_SIZE * 3}`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
  );
  if (!res.ok) {
    console.error(`Recipe fetch failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const recipes = await res.json() as RecipeRow[];

  const output: { index: number, id: string, slug: string, nombre: string, prompt: string }[] = [];
  const unknown = new Map<string, string[]>();

  for (const recipe of recipes) {
    if (output.length >= BATCH_SIZE) { break; }
    const built = buildEnglishPrompt(recipe);
    if (!built.ok) {
      for (const term of built.missing) { unknown.set(term, [...unknown.get(term) ?? [], recipe.nombre]); }
      continue;
    }
    output.push({ index: output.length + 1, id: recipe.id, slug: recipe.slug, nombre: recipe.nombre, prompt: built.prompt });
  }

  for (const [term, names] of unknown) {
    console.error(`  skipped ${names.length} recipe(s) on "${term}": ${names.join('; ')}`);
  }
  console.error(`Built ${output.length} prompts (batch size ${BATCH_SIZE}). Writing JSON to stdout.`);
  console.log(JSON.stringify(output, null, 2));
}

void main();
