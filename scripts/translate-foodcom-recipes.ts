#!/usr/bin/env bun

// FRESCO-144 — Food.com recipe dataset migration, Stage 2 (translate + map).
// Usage: bun scripts/translate-foodcom-recipes.ts [batchSize=30] [candidatesPath=data/raw/foodcom-candidates.json] [progressPath=data/raw/foodcom-translate-progress.json] > /tmp/batch.json
//
// Reads Stage 1's candidate JSON (`scripts/curate-foodcom-recipes.ts`), sends
// each not-yet-processed candidate to Gemini with a structured-output prompt
// (translate to Spanish, map onto Fresco's existing taxonomy), validates the
// result against the `Recipe`/`RecipeClasificacion`/`RecipeDieta` shapes and
// the LIVE `alergenos` vocabulary (queried from `recipes.alergenos` via
// Supabase MCP — the type file itself flags the vocabulary as
// under-specified, so this uses ground truth over the doc), and prints a
// JSON array of ready-to-insert rows to stdout (progress/logs to stderr).
// Rejected candidates are logged, not emitted — never inserted blind.
//
// Same emit-don't-insert pattern as `fetch-recipe-photos.ts`: this script
// never writes to Postgres. Converting a batch's JSON to SQL and applying it
// via the Supabase MCP is Task 10 (FRESCO-147)'s job, done per-batch with a
// `RecipeDataContract` check after each one.
//
// Resumable: `progressPath` tracks every `source_recipe_id` this script has
// already attempted (accepted OR rejected) so re-running after a partial
// failure — or across sessions, same cadence as the 36-batch photo backfill
// — never re-spends on a candidate already resolved one way or the other.
//
// Uses the Gemini `interactions` API directly via `fetch` (no SDK dependency,
// matching this repo's existing scripts) — current as of the May 2026
// `response_format`/`interactions` migration
// (https://ai.google.dev/gemini-api/docs/migrate-to-interactions). Model is
// configurable via `GEMINI_MODEL` (default `gemini-3.6-flash`) since model
// names change faster than this script should need editing.

import type { FoodComCandidate } from './curate-foodcom-recipes';
import { z } from 'zod';
import { DATASET_SOURCE } from './curate-foodcom-recipes';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.6-flash';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';

const BATCH_SIZE = Number(process.argv[2] ?? 30);
const CANDIDATES_PATH = process.argv[3] ?? 'data/raw/foodcom-candidates.json';
const PROGRESS_PATH = process.argv[4] ?? 'data/raw/foodcom-translate-progress.json';

// Mirrors the literal unions in `api/schemas/recipe.types.ts`. Duplicated
// here (not imported) because those are compile-time-only types — both the
// outbound Gemini schema and the inbound runtime validation need real
// arrays/enums to check against. Keep in sync by hand if the source types
// change; a mismatch here fails LOUD (every candidate gets rejected with a
// visible reason), not silently.
const TIPO_PLATO = ['desayuno', 'comida', 'cena', 'snack'] as const;
const CATEGORIA_RECETA = ['pasta', 'arroz', 'legumbres', 'carne', 'pescado', 'verdura', 'huevos', 'sopa', 'ensalada', 'sandwich', 'pizza', 'guiso'] as const;
const TIPO_COCINA = ['española', 'italiana', 'mexicana', 'asiática', 'mediterránea', 'latina', 'internacional'] as const;
const COSTE_ESTIMADO = ['muy_bajo', 'bajo', 'medio', 'alto'] as const;
const DIFICULTAD_RECETA = ['muy_facil', 'facil', 'media', 'avanzada'] as const;
const TEMPORADA = ['primavera', 'verano', 'otoño', 'invierno', 'todo_el_año'] as const;

// Live vocabulary, not the disputed doc list — queried 2026-08-09 via
// `select distinct jsonb_array_elements_text(alergenos) from recipes`.
const ALERGENOS_VOCAB = [
  'apio',
  'cacahuetes',
  'crustaceos',
  'frutos_de_cascara',
  'frutos_secos',
  'gluten',
  'huevo',
  'lactosa',
  'moluscos',
  'pescado',
  'sesamo',
  'soja',
  'sulfitos',
] as const;

export const translatedRecipeSchema = z.object({
  nombre: z.string().min(1),
  descripcion_corta: z.string().min(1),
  meta: z.object({
    tiempo_prep_min: z.number().nonnegative(),
    tiempo_coccion_min: z.number().nonnegative(),
    tiempo_total_min: z.number().nonnegative(),
    raciones: z.number().positive(),
    coste_estimado: z.enum(COSTE_ESTIMADO),
    dificultad: z.enum(DIFICULTAD_RECETA),
  }),
  clasificacion: z.object({
    tipo_plato: z.enum(TIPO_PLATO),
    categoria: z.enum(CATEGORIA_RECETA),
    cocina: z.enum(TIPO_COCINA),
    es_contundente: z.boolean(),
    es_ligero: z.boolean(),
    es_comfort_food: z.boolean(),
    apto_tupper: z.boolean(),
    apto_congelar: z.boolean(),
  }),
  dieta: z.object({
    vegetariano: z.boolean(),
    vegano: z.boolean(),
    sin_gluten: z.boolean(),
    sin_lactosa: z.boolean(),
    sin_huevo: z.boolean(),
    bajo_fodmap: z.boolean(),
    keto: z.boolean(),
    paleo: z.boolean(),
    halal: z.boolean(),
    kosher: z.boolean(),
  }),
  alergenos: z.array(z.enum(ALERGENOS_VOCAB)),
  ingredientes_principales: z.array(z.string().min(1)).min(1),
  ingredientes_que_puede_desagradar: z.array(z.string()),
  temporada: z.array(z.enum(TEMPORADA)).min(1),
  pasos_resumen: z.array(z.string().min(1)).min(1),
});

export type TranslatedRecipe = z.infer<typeof translatedRecipeSchema>;

export interface RecipeInsertRow extends TranslatedRecipe {
  slug: string
  source: typeof DATASET_SOURCE & { source_recipe_id: string }
}

/** Plain JSON Schema matching the Gemini `interactions` `response_format.schema` dialect (lowercase types, `enum` arrays). */
export function buildResponseSchema(): Record<string, unknown> {
  const enumOf = (values: readonly string[]) => ({ type: 'string', enum: [...values] });
  return {
    type: 'object',
    properties: {
      nombre: { type: 'string', description: 'Nombre del plato en español, natural, sin coletillas de marketing.' },
      descripcion_corta: { type: 'string', description: 'Una frase describiendo el plato en español.' },
      meta: {
        type: 'object',
        properties: {
          tiempo_prep_min: { type: 'integer' },
          tiempo_coccion_min: { type: 'integer' },
          tiempo_total_min: { type: 'integer' },
          raciones: { type: 'integer' },
          coste_estimado: enumOf(COSTE_ESTIMADO),
          dificultad: enumOf(DIFICULTAD_RECETA),
        },
        required: ['tiempo_prep_min', 'tiempo_coccion_min', 'tiempo_total_min', 'raciones', 'coste_estimado', 'dificultad'],
      },
      clasificacion: {
        type: 'object',
        properties: {
          tipo_plato: enumOf(TIPO_PLATO),
          categoria: enumOf(CATEGORIA_RECETA),
          cocina: enumOf(TIPO_COCINA),
          es_contundente: { type: 'boolean' },
          es_ligero: { type: 'boolean' },
          es_comfort_food: { type: 'boolean' },
          apto_tupper: { type: 'boolean' },
          apto_congelar: { type: 'boolean' },
        },
        required: ['tipo_plato', 'categoria', 'cocina', 'es_contundente', 'es_ligero', 'es_comfort_food', 'apto_tupper', 'apto_congelar'],
      },
      dieta: {
        type: 'object',
        properties: {
          vegetariano: { type: 'boolean' },
          vegano: { type: 'boolean' },
          sin_gluten: { type: 'boolean' },
          sin_lactosa: { type: 'boolean' },
          sin_huevo: { type: 'boolean' },
          bajo_fodmap: { type: 'boolean' },
          keto: { type: 'boolean' },
          paleo: { type: 'boolean' },
          halal: { type: 'boolean' },
          kosher: { type: 'boolean' },
        },
        required: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa', 'sin_huevo', 'bajo_fodmap', 'keto', 'paleo', 'halal', 'kosher'],
      },
      alergenos: { type: 'array', items: enumOf(ALERGENOS_VOCAB), description: 'Solo alérgenos realmente presentes. Array vacío si no hay ninguno.' },
      ingredientes_principales: { type: 'array', items: { type: 'string' }, description: '3-6 ingredientes principales, en español.' },
      ingredientes_que_puede_desagradar: { type: 'array', items: { type: 'string' }, description: 'Ingredientes que un comensal picky podría rechazar. Array vacío si ninguno destaca.' },
      temporada: { type: 'array', items: enumOf(TEMPORADA), description: 'Al menos un valor. Usa todo_el_año si no hay estacionalidad clara.' },
      pasos_resumen: { type: 'array', items: { type: 'string' }, description: 'Pasos de preparación resumidos en español, en orden.' },
    },
    required: ['nombre', 'descripcion_corta', 'meta', 'clasificacion', 'dieta', 'alergenos', 'ingredientes_principales', 'ingredientes_que_puede_desagradar', 'temporada', 'pasos_resumen'],
  };
}

export function buildPrompt(candidate: FoodComCandidate): string {
  return [
    'Traduce y clasifica esta receta para el catálogo de Fresco.',
    '',
    `Nombre original (inglés): ${candidate.name}`,
    `Descripción original: ${candidate.description || '(sin descripción)'}`,
    `Categoría original: ${candidate.category || '(sin categoría)'}`,
    `Palabras clave: ${candidate.keywords.join(', ') || '(ninguna)'}`,
    `Cantidades de ingredientes: ${candidate.ingredients_quantities.join(', ') || '(no especificadas)'}`,
    `Ingredientes: ${candidate.ingredients_parts.join(', ')}`,
    `Instrucciones: ${candidate.instructions.join(' ')}`,
    `Raciones (dato original, puede ser aproximado): ${candidate.servings || '(desconocido)'}`,
    `Tiempo de preparación (ISO 8601): ${candidate.prep_time_iso8601 || '(desconocido)'}`,
    `Tiempo de cocción (ISO 8601): ${candidate.cook_time_iso8601 || '(desconocido)'}`,
    `Tiempo total (ISO 8601): ${candidate.total_time_iso8601 || '(desconocido)'}`,
    '',
    'Traduce nombre, descripción, ingredientes principales y pasos a español natural (no traducción literal palabra por palabra).',
    'Clasifica dentro de las categorías EXACTAS permitidas por el esquema — no inventes valores nuevos.',
    'Convierte los tiempos ISO 8601 a minutos enteros.',
  ].join('\n');
}

async function callGemini(candidate: FoodComCandidate): Promise<unknown> {
  const res = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      system_instruction: 'Eres un asistente que traduce y clasifica recetas de cocina para una app española. Respondes siempre con el JSON exacto pedido, sin texto adicional.',
      input: buildPrompt(candidate),
      response_format: { type: 'text', mime_type: 'application/json', schema: buildResponseSchema() },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
  }

  const body = await res.json() as {
    steps?: { type: string, content?: { type: string, text?: string }[] }[]
    output_text?: string
  };

  // Prefer the documented `interactions` resource shape (steps timeline);
  // fall back to a bare `output_text` in case the endpoint returns the
  // simplified form for non-streaming structured-output calls.
  const modelOutputText = body.steps
    ?.find(step => step.type === 'model_output')
    ?.content
    ?.find(part => part.type === 'text')
    ?.text ?? body.output_text;

  if (!modelOutputText) {
    throw new Error(`Gemini response had no model_output text: ${JSON.stringify(body)}`);
  }
  return JSON.parse(modelOutputText);
}

/** Lowercase, accent-stripped, hyphenated — suffixed with the source id so translated names can never collide. */
export function slugify(nombre: string, sourceRecipeId: string): string {
  const base = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base}-fc${sourceRecipeId}`;
}

interface Progress {
  processedIds: string[]
  rejectedIds: Record<string, string>
}

async function loadProgress(path: string): Promise<Progress> {
  const file = Bun.file(path);
  if (!(await file.exists())) { return { processedIds: [], rejectedIds: {} }; }
  return await file.json() as Progress;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const candidates = await Bun.file(CANDIDATES_PATH).json() as FoodComCandidate[];
  const progress = await loadProgress(PROGRESS_PATH);
  const processed = new Set(progress.processedIds);

  const pending = candidates.filter(c => !processed.has(c.source_recipe_id)).slice(0, BATCH_SIZE);
  console.error(`${candidates.length} total candidates, ${processed.size} already processed, ${pending.length} in this batch.`);

  const results: RecipeInsertRow[] = [];

  for (const candidate of pending) {
    let raw: unknown;
    try {
      raw = await callGemini(candidate);
    }
    catch (err) {
      // Transport/API-level failure (network, rate limit, 5xx) — NOT the
      // model's fault. Log it but deliberately don't mark this candidate
      // processed, so the next run retries it instead of blacklisting a
      // recipe that never actually got a verdict.
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`ERROR (will retry next run) [${candidate.source_recipe_id}] ${candidate.name}: ${reason}`);
      await sleep(1000);
      continue;
    }

    const parsed = translatedRecipeSchema.safeParse(raw);
    if (!parsed.success) {
      const reason = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      progress.rejectedIds[candidate.source_recipe_id] = reason;
      console.error(`REJECTED [${candidate.source_recipe_id}] ${candidate.name}: ${reason}`);
    }
    else {
      results.push({
        ...parsed.data,
        slug: slugify(parsed.data.nombre, candidate.source_recipe_id),
        source: { ...DATASET_SOURCE, source_recipe_id: candidate.source_recipe_id },
      });
      console.error(`OK [${candidate.source_recipe_id}] ${candidate.name} -> ${parsed.data.nombre}`);
    }
    processed.add(candidate.source_recipe_id);
    await sleep(1000);
  }

  progress.processedIds = [...processed];
  await Bun.write(PROGRESS_PATH, JSON.stringify(progress, null, 2));

  console.error(`Batch done: ${results.length} accepted, ${pending.length - results.length} rejected/errored. Progress saved to ${PROGRESS_PATH}.`);
  console.log(JSON.stringify(results));
}

if (import.meta.main) { void main(); }
