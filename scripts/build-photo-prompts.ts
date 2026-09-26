#!/usr/bin/env bun

// FRESCO-435 — builds AI-image-generation prompts for recipes missing a
// photo, straight from the recipe's own structured fields (nombre,
// descripcion_corta, ingredientes_principales, pasos_resumen) instead of a
// hand-paraphrased translation. Root cause of the first live test's one real
// miss ("Tofu revuelto estilo mexicano con cilantro" rendered as fried cubes,
// missing pimiento + jengibre): the prompt was hand-translated from `nombre`
// alone and silently dropped 2 of the recipe's 4 `ingredientes_principales`.
// Transcribing the DB fields verbatim (Spanish, no paraphrase) removes that
// failure mode — Qwen/most modern image models handle Spanish prompts fine,
// and a complete ingredient list in Spanish beats an incomplete one in
// English.
//
// Manual workflow (no image-gen API integration — Qwen Studio / ChatGPT
// image gen are web-UI-only for this user, see FRESCO-435 comments):
//   1. bun scripts/build-photo-prompts.ts [batchSize=20] > /tmp/prompts.json
//   2. Paste each `prompt` one at a time into the image tool.
//   3. Save each output image named "<index>-<slug>.png" in one folder,
//      matching the `index` printed alongside each prompt.
//   4. (Next script, not yet built) uploads that folder + applies foto_url.
//
// Excludes the same `usedUrls`-style safety this table already has: none
// needed here (no dedup against a photo bank), but DOES reuse the same
// `foto_url is null and activo = true` filter as fetch-recipe-photos.ts so
// this never spends manual generation effort on soft-deleted catalog rows.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BATCH_SIZE = Number(process.argv[2] ?? 20);

interface RecipeRow {
  id: string
  nombre: string
  slug: string
  descripcion_corta: string
  ingredientes_principales: string[]
  pasos_resumen: string[]
}

// Fixed composition contract, validated live (2026-09-11): Qwen Studio's
// default framing put a server's hand + restaurant background in-frame for
// an unconstrained prompt ("Paella Española"). This block, prepended to
// every prompt, produced 8/8 clean single-plate/no-people/no-props shots in
// the follow-up test batch — keep it verbatim, it's the fix for that
// specific failure, not decoration.
const COMPOSITION_PREFIX = [
  'Fotografia de comida realista, vista cenital o en angulo de 3/4, un unico plato o bol,',
  'fondo neutro liso, luz natural, SIN personas, SIN manos, SIN utensilios de atrezo ni decoracion sobrante,',
  'estilo minimalista de calidad de restaurante, fotorrealista.',
  'Detalle fotografico: profundidad de campo reducida (fondo ligeramente desenfocado), brillo natural de',
  'aceite/jugos en la superficie de la comida, sombra suave y difusa del plato, textura de superficie nitida',
  'y realista (nada de aspecto plastico, liso o renderizado en 3D).',
].join(' ');

// SHAPE_CUES fixes a failure mode distinct from TEXTURE_CUES: TEXTURE_CUES
// describes what a cooking TECHNIQUE does to an ingredient (desmenuzado,
// rallado...); SHAPE_CUES describes the ingredient's own base form, needed
// when the model has a strong competing prior for that word. Live-tested
// (2026-09-12): "Tempeh a la plancha con ajo" rendered as grilled TOAST
// SLICES, not tempeh — the model defaulted to its strongest visual prior for
// "grilled rectangular slices" instead of tempeh's actual porous block form.
// Matched against ingredientes_principales (the ingredient itself), not
// pasos_resumen (the technique) — same accent-stripped/lowercased pattern.
const SHAPE_CUES: { pattern: RegExp, cue: string }[] = [
  {
    pattern: /\btempeh\b/,
    cue: 'Forma del tempeh: bloque compacto y poroso con pequeños agujeros irregulares visibles en la superficie, textura fibrosa densa — NO debe parecer pan, tostada ni tofu liso.',
  },
  {
    pattern: /\btofu\b/,
    cue: 'Forma del tofu: bloque o dados de superficie lisa, uniforme y color blanco marfil, sin agujeros ni fibra visible — NO debe parecer tempeh ni queso.',
  },
];

function shapeCue(ingredientesText: string): string | null {
  const normalized = ingredientesText.normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase();
  const match = SHAPE_CUES.find(({ pattern }) => pattern.test(normalized));
  return match?.cue ?? null;
}

// v2 — texture/technique cue, live-tested against "Tofu revuelto estilo
// mexicano con cilantro" (2026-09-11). Putting `pasos_resumen` in a
// secondary "Preparacion (no listar...)" field got ignored by the model —
// the ingredient list came back complete (that fix worked) but the texture
// stayed wrong (cubed, not "desmenuzado"/crumbled). Fix: detect the
// technique verb in `pasos_resumen` and inject an explicit visual
// instruction — with a NO/SI contrast where the default rendering is known
// to guess wrong — directly into the `Plato:` line itself, the highest-
// weight position in the prompt, instead of a footnote further down.
// Matched against the accent-stripped, lowercased join of `pasos_resumen`.
// Extend this table as new live tests surface more technique mismatches —
// same "found it live, fixed it here" pattern as fetch-recipe-photos.ts's
// ES_EN_WORDS dictionary.
const TEXTURE_CUES: { pattern: RegExp, cue: string }[] = [
  {
    pattern: /\bdesmenuza/,
    cue: 'Textura DESMENUZADA e irregular en trozos pequeños e irregulares, como huevo revuelto — NO cortado en dados ni en cubos regulares.',
  },
  {
    pattern: /\brallad[oa]/,
    cue: 'Rallado en hebras finas, NO en trozos grandes ni en dados.',
  },
  {
    pattern: /\bpicad[oa]/,
    cue: 'Picado en trozos pequeños y uniformes.',
  },
  {
    pattern: /\btritura|\blicua|\bbatid[oa]/,
    cue: 'Textura triturada, suave y homogénea (tipo puré, crema o batido), sin trozos enteros visibles.',
  },
  {
    pattern: /\bplancha/,
    cue: 'A la plancha, con marcas de tueste/parrilla visibles en la superficie.',
  },
  {
    pattern: /\bhorno|\bhornea|\basad[oa]/,
    cue: 'Asado/horneado entero o en una pieza grande, con la superficie tostada.',
  },
  {
    pattern: /\bguisa|\bestofad[oa]/,
    cue: 'Guisado, con salsa espesa cubriendo los ingredientes, NO seco ni salteado.',
  },
];

function textureCue(pasosText: string): string | null {
  const normalized = pasosText.normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase();
  const match = TEXTURE_CUES.find(({ pattern }) => pattern.test(normalized));
  return match?.cue ?? null;
}

function buildPrompt(recipe: RecipeRow): string {
  const ingredientes = recipe.ingredientes_principales?.length
    ? recipe.ingredientes_principales.join(', ')
    : '(sin listar)';
  const pasos = recipe.pasos_resumen?.length
    ? recipe.pasos_resumen.join(' ')
    : '(sin listar)';
  const texture = textureCue(pasos);
  const shape = shapeCue(ingredientes);
  const cues = [texture, shape].filter((c): c is string => c !== null);

  return [
    COMPOSITION_PREFIX,
    '',
    `Plato: ${recipe.nombre}${cues.length ? ` — ${cues.join(' ')}` : ''}`,
    `Descripcion: ${recipe.descripcion_corta}`,
    `Ingredientes principales que DEBEN verse claramente en la imagen: ${ingredientes}`,
    `Preparacion (contexto adicional de tecnica): ${pasos}`,
    '',
    'Todos los ingredientes principales listados tienen que ser reconocibles a simple vista en el plato final. No anadir ingredientes que no esten en la lista.',
  ].join('\n');
}

async function main() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/recipes?select=id,nombre,slug,descripcion_corta,ingredientes_principales,pasos_resumen&foto_url=is.null&activo=eq.true&limit=${BATCH_SIZE}`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
  );
  const recipes = await res.json() as RecipeRow[];

  const output = recipes.map((r, i) => ({
    index: i + 1,
    id: r.id,
    slug: r.slug,
    nombre: r.nombre,
    prompt: buildPrompt(r),
  }));

  console.error(`Built ${output.length} prompts (batch size ${BATCH_SIZE}). Writing JSON to stdout.`);
  console.log(JSON.stringify(output, null, 2));
}

void main();
