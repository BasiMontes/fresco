#!/usr/bin/env bun

// FRESCO-449 — deterministic cleanup of `recipes.nombre` (no LLM, per explicit
// user decision: zero additional API spend). The combinatorial name-generator
// used for the offline batch-drafting flow (project-dev-guide.md § Batch
// Recipe-Catalog Seeding) stitched a template together — base dish + filler
// wrapper phrases + a flavor descriptor — and left dangling connectors when a
// slot was empty. Rules + rationale: `.context/business/recipe-name-voice-guide.md`.
// The FILLER_PHRASES list mirrors the one validated live in FRESCO-31's
// `fetch-recipe-photos.ts` (same generator, same bug, already proven there to
// carry zero signal).
//
// Usage:
//   bun scripts/clean-recipe-names.ts              # dry-run, logs id | before -> after
//   bun scripts/clean-recipe-names.ts --apply       # writes changed rows via service_role

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APPLY = process.argv.includes('--apply');
const PAGE_SIZE = 500;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

// Wrapper phrases that carry zero signal — accent-tolerant, matched
// case-insensitively. A *named* spice/herb/descriptor after "con" is real
// content and stays (e.g. "con canela", "con frutos rojos").
const FILLER_PHRASE_SOURCES = [
  'al estilo (?:mediterr[aá]neo|del sur)',
  'estilo casero',
  'versi[oó]n ligera',
  'con guarnici[oó]n de temporada',
  'con verduras de temporada',
  'con especias',
  'con hierbas frescas',
];

// A bare wrapper phrase ("con especias", "estilo casero"...) only gets
// stripped when it is a whole clause on its own — followed by the next
// connector/filler-phrase or the end of the name. Without this guard,
// "con especias orientales al horno" would strip "con especias" and leave
// "orientales" dangling with no connector in front of it.
const CLAUSE_BOUNDARY = String.raw`(?=\s+(?:con|y|de|al|a la|estilo|versi[oó]n)\b|\s*$)`;
const FILLER_PHRASES: RegExp[] = FILLER_PHRASE_SOURCES.map(
  source => new RegExp(String.raw`\b${source}\b${CLAUSE_BOUNDARY}`, 'gi'),
);

// Two adjacent connector words means the generator left a slot empty and
// concatenated straight through it — collapse to the one that still reads.
const DANGLING_CONNECTOR_MID_PAIRS: [RegExp, string][] = [
  [/\b(con|de)\s+y\s+/gi, '$1 '], // "con y tamari" -> "con tamari"
  [/\by\s+(con|de)\s+/gi, '$1 '], // "coco y con semillas" -> "coco con semillas"
];

const TRAILING_CONNECTOR = /\s+(?:a la|con|y|de|al)$/i;
const MAX_WORDS = 6;
// Only "con"/"y" introduce a new trailing descriptor clause ("con canela",
// "y jengibre"). "de"/"al" glue to the noun right before them ("semillas de
// lino", "al ajillo") — treating them as clause boundaries would cut a
// compound noun in half instead of dropping it whole.
const CLAUSE_CONNECTORS = new Set(['con', 'y']);

function collapseConnectors(input: string): string {
  let out = input;
  for (const [pattern, replacement] of DANGLING_CONNECTOR_MID_PAIRS) {
    out = out.replace(pattern, replacement);
  }
  out = out.replace(/\s+/g, ' ').trim();
  // Trailing dangling connector can appear iteratively after truncation.
  let prev: string;
  do {
    prev = out;
    out = out.replace(TRAILING_CONNECTOR, '').trim();
  } while (out !== prev);
  return out;
}

function capitalize(input: string): string {
  if (!input) { return input; }
  return input[0].toUpperCase() + input.slice(1);
}

// Drops whole trailing descriptor clauses (from the last "con"/"y" onward)
// until the word count fits — never cuts a clause in half, which would
// mangle a compound descriptor ("frutos rojos" -> "frutos").
function truncateToClauses(name: string, maxWords: number): string {
  let words = name.split(' ').filter(Boolean);
  while (words.length > maxWords) {
    let lastConnectorIdx = -1;
    for (let i = 1; i < words.length; i++) {
      if (CLAUSE_CONNECTORS.has(words[i].toLowerCase())) { lastConnectorIdx = i; }
    }
    if (lastConnectorIdx === -1) {
      // No clause boundary left to drop — the base dish name itself is long.
      words = words.slice(0, maxWords);
      break;
    }
    words = words.slice(0, lastConnectorIdx);
  }
  return words.join(' ');
}

export function cleanRecipeName(original: string): string {
  let name = original;
  for (const phrase of FILLER_PHRASES) {
    name = name.replace(phrase, ' ');
  }
  name = collapseConnectors(name);

  if (name.split(' ').filter(Boolean).length > MAX_WORDS) {
    name = truncateToClauses(name, MAX_WORDS);
    name = collapseConnectors(name);
  }

  const cleaned = capitalize(name.trim());
  // Never collapse a name to nothing — a pathological input (the whole
  // string was itself filler) falls back to the original untouched, for a
  // human to review, rather than writing an empty nombre.
  return cleaned || original;
}

interface RecipeRow {
  id: string
  nombre: string
}

async function fetchAllRecipes(): Promise<RecipeRow[]> {
  const all: RecipeRow[] = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/recipes?select=id,nombre&order=id&offset=${offset}&limit=${PAGE_SIZE}`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
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

async function applyUpdate(id: string, nombre: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/recipes?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ nombre }),
  });
  if (!res.ok) {
    throw new Error(`Update failed for id=${id}: ${res.status} ${await res.text()}`);
  }
}

async function main() {
  console.error(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  const recipes = await fetchAllRecipes();
  console.error(`Fetched ${recipes.length} recipes.`);

  let changed = 0;
  for (const recipe of recipes) {
    const cleaned = cleanRecipeName(recipe.nombre);
    if (cleaned !== recipe.nombre) {
      changed++;
      console.log(`${recipe.id} | ${recipe.nombre} -> ${cleaned}`);
      if (APPLY) {
        await applyUpdate(recipe.id, cleaned);
      }
    }
  }
  console.error(`${changed}/${recipes.length} names changed.${APPLY ? ' Applied.' : ' Dry-run only — pass --apply to write.'}`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
