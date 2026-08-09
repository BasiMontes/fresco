#!/usr/bin/env bun

// FRESCO-142 — Food.com recipe dataset migration, Stage 1 (curate).
// Usage: bun scripts/curate-foodcom-recipes.ts [csvPath=data/raw/recipes.csv] [outPath=data/raw/foodcom-candidates.json] [limit=1000] [minRating=4]
//
// Reads the raw Kaggle CSV (Irkaal's "Food.com Recipes and Reviews"),
// filters incomplete/low-rated rows, dedupes against the existing catalog,
// and writes surviving candidates to `outPath` for inspection before any
// Gemini spend in Stage 2 (`scripts/translate-foodcom-recipes.ts`, Task 6).
// No AI calls. Progress goes to stderr.
//
// One deliberate deviation from the design spec's "no network calls beyond
// reading the local CSV": deduping against the existing catalog requires a
// read of `recipes.nombre`/`slug`, which this script fetches via the same
// read-only Supabase REST pattern `fetch-recipe-photos.ts` (FRESCO-31)
// already uses for its own pre-run seed fetch. The spec's "no network
// calls" line is read as "no AI provider calls" (the thing Stage 2
// introduces), not a ban on the one read this stage's own dedup step
// requires — there is no local cache of the catalog to read instead.
//
// The dataset's recipe names/ingredients/instructions are in ENGLISH; the
// existing catalog is in SPANISH. A same-language loose-match dedupe (as
// specified) will rarely fire against real near-duplicates across that
// language gap — a known limitation inherited from the approved spec, not
// something this script attempts to fix (translation happens in Stage 2,
// after this dedup step already ran). Flagging here for Task 9's spot-check.

import type { RecipeSource } from '@schemas';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const CSV_PATH = process.argv[2] ?? 'data/raw/recipes.csv';
const OUT_PATH = process.argv[3] ?? 'data/raw/foodcom-candidates.json';
const LIMIT = Number(process.argv[4] ?? 1000);
const MIN_RATING = Number(process.argv[5] ?? 4);

export const DATASET_SOURCE: Pick<RecipeSource, 'provider' | 'dataset' | 'dataset_publisher' | 'declared_license'> = {
  provider: 'Food.com',
  dataset: 'Food.com Recipes and Reviews',
  dataset_publisher: 'Irkaal',
  declared_license: 'CC0 1.0',
};

export interface FoodComCandidate {
  source_recipe_id: string
  name: string
  description: string
  ingredients_quantities: string[]
  ingredients_parts: string[]
  instructions: string[]
  keywords: string[]
  category: string
  rating: number | null
  review_count: number | null
  servings: string
  cook_time_iso8601: string
  prep_time_iso8601: string
  total_time_iso8601: string
}

/**
 * Streaming, quote-aware CSV row parser. Handles quoted fields containing
 * commas/newlines and RFC4180 double-quote escaping (`""` -> `"`) across
 * chunk boundaries — this dataset's Instructions/Keywords/Ingredient*
 * columns are long, embed both. Deliberately not a library dep: the parsing
 * rules needed here are a handful of states, and a 704MB file needs
 * streaming rather than a load-the-whole-string parser.
 */
export async function* parseCsvRows(path: string): AsyncGenerator<string[]> {
  const stream = Bun.file(path).stream();
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let pendingQuoteClose = false;

  function pushField(): void { row.push(field); field = ''; }
  function pushRow(): string[] { pushField(); const r = row; row = []; return r; }

  function processChar(c: string): string[] | null {
    if (inQuotes) {
      if (c === '"') { inQuotes = false; pendingQuoteClose = true; }
      else { field += c; }
      return null;
    }
    if (pendingQuoteClose) {
      pendingQuoteClose = false;
      if (c === '"') { field += '"'; inQuotes = true; return null; }
      // fall through — the quote really closed, handle `c` normally below
    }
    if (c === '"') { inQuotes = true; return null; }
    if (c === ',') { pushField(); return null; }
    if (c === '\r') { return null; }
    if (c === '\n') { return pushRow(); }
    field += c;
    return null;
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) { break; }
    const chunk = decoder.decode(value, { stream: true });
    for (const c of chunk) {
      const completedRow = processChar(c);
      if (completedRow) { yield completedRow; }
    }
  }
  if (field.length > 0 || row.length > 0) { yield pushRow(); }
}

/**
 * Parses this dataset's R-language vector-literal string columns, e.g.
 * `c("Cook rice", "Add spices")` -> `["Cook rice", "Add spices"]`. Not a
 * full R parser — matches quoted elements, which covers every column this
 * script reads. A malformed/unparseable value degrades to an empty array
 * rather than throwing, so one bad row doesn't kill the whole run.
 */
export function parseRVector(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('c(') || !trimmed.endsWith(')')) {
    return trimmed ? [trimmed] : [];
  }
  const inner = trimmed.slice(2, -1);
  const items: string[] = [];
  const re = /"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((m = re.exec(inner)) !== null) {
    items.push(m[1].replace(/\\"/g, '"').trim());
  }
  return items;
}

/** Lowercase, accent-stripped, punctuation-collapsed — for loose dedup matching. */
export function normalizeForDedup(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface RawFoodComRow {
  RecipeId: string
  Name: string
  Description: string
  RecipeIngredientQuantities: string
  RecipeIngredientParts: string
  RecipeInstructions: string
  Keywords: string
  RecipeCategory: string
  AggregatedRating: string
  ReviewCount: string
  RecipeServings: string
  CookTime: string
  PrepTime: string
  TotalTime: string
}

/** `null` = missing/unparseable required field, filtered out before rating/dedup checks. */
export function toCandidate(row: RawFoodComRow): FoodComCandidate | null {
  const name = row.Name?.trim();
  const ingredientsParts = parseRVector(row.RecipeIngredientParts ?? '');
  const instructions = parseRVector(row.RecipeInstructions ?? '');
  if (!name || ingredientsParts.length === 0 || instructions.length === 0) { return null; }

  const ratingRaw = row.AggregatedRating?.trim();
  const rating = ratingRaw ? Number(ratingRaw) : null;
  const reviewCountRaw = row.ReviewCount?.trim();

  return {
    source_recipe_id: row.RecipeId,
    name,
    description: row.Description?.trim() ?? '',
    ingredients_quantities: parseRVector(row.RecipeIngredientQuantities ?? ''),
    ingredients_parts: ingredientsParts,
    instructions,
    keywords: parseRVector(row.Keywords ?? ''),
    category: row.RecipeCategory?.trim() ?? '',
    rating: rating !== null && !Number.isNaN(rating) ? rating : null,
    review_count: reviewCountRaw ? Number(reviewCountRaw) : null,
    servings: row.RecipeServings?.trim() ?? '',
    cook_time_iso8601: row.CookTime?.trim() ?? '',
    prep_time_iso8601: row.PrepTime?.trim() ?? '',
    total_time_iso8601: row.TotalTime?.trim() ?? '',
  };
}

/** A candidate below `minRating` is rejected ONLY when it has a rating at all — unrated rows pass through. */
export function passesRatingThreshold(candidate: FoodComCandidate, minRating: number): boolean {
  return candidate.rating === null || candidate.rating >= minRating;
}

export function isDuplicate(candidate: FoodComCandidate, existingNormalized: Set<string>): boolean {
  return existingNormalized.has(normalizeForDedup(candidate.name));
}

async function fetchExistingNormalizedNames(): Promise<Set<string>> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/recipes?select=nombre,slug`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
  );
  if (!res.ok) { throw new Error(`Failed to fetch existing catalog: ${res.status} ${await res.text()}`); }
  const rows = await res.json() as { nombre: string, slug: string }[];
  const normalized = new Set<string>();
  for (const row of rows) {
    normalized.add(normalizeForDedup(row.nombre));
    normalized.add(normalizeForDedup(row.slug.replace(/-/g, ' ')));
  }
  return normalized;
}

async function main(): Promise<void> {
  console.error('Fetching existing catalog for dedup...');
  const existingNormalized = await fetchExistingNormalizedNames();
  console.error(`Seeded ${existingNormalized.size} existing normalized names/slugs.`);

  console.error(`Reading ${CSV_PATH}...`);
  let header: string[] | null = null;
  let headerIndex: Record<string, number> = {};
  let scanned = 0;
  let rejectedIncomplete = 0;
  let rejectedRating = 0;
  let rejectedDuplicate = 0;
  const candidates: FoodComCandidate[] = [];

  for await (const fields of parseCsvRows(CSV_PATH)) {
    if (!header) {
      header = fields;
      headerIndex = Object.fromEntries(header.map((h, i) => [h, i]));
      continue;
    }
    scanned++;

    const row = Object.fromEntries(
      Object.entries(headerIndex).map(([key, i]) => [key, fields[i] ?? '']),
    ) as unknown as RawFoodComRow;

    const candidate = toCandidate(row);
    if (!candidate) { rejectedIncomplete++; continue; }
    if (!passesRatingThreshold(candidate, MIN_RATING)) { rejectedRating++; continue; }
    if (isDuplicate(candidate, existingNormalized)) { rejectedDuplicate++; continue; }

    candidates.push(candidate);
    if (candidates.length >= LIMIT) { break; }

    if (scanned % 20000 === 0) {
      console.error(`Scanned ${scanned} rows, ${candidates.length} candidates so far...`);
    }
  }

  await Bun.write(OUT_PATH, JSON.stringify(candidates, null, 2));
  console.error(
    `Scanned ${scanned} rows -> ${candidates.length} candidates written to ${OUT_PATH} `
    + `(rejected: ${rejectedIncomplete} incomplete, ${rejectedRating} below rating threshold, ${rejectedDuplicate} duplicate).`,
  );
}

if (import.meta.main) { void main(); }
