#!/usr/bin/env bun

// FRESCO-524 — backfill for the 47 groups (110 rows) of active recipes that
// share an identical `nombre` even though they are genuinely distinct
// recipes (confirmed case-by-case in FRESCO-522: different
// `ingredientes_principales`, never real duplicates). Root cause: the
// offline combinatorial generator used to draft the original catalog
// (`project-dev-guide.md` § Batch Recipe-Catalog Seeding) propagated the
// per-recipe variable ingredient into `descripcion_corta` but never into the
// displayed `nombre`. That generator is prose-governed, not code — see the
// FRESCO-524 rule added to `recipe-name-voice-guide.md`, which is the actual
// prevention mechanism for future batches. This script only repairs the 110
// rows that already exist.
//
// Derivation, no LLM (same zero-spend posture as FRESCO-449/526): within a
// duplicate-`nombre` group, every row's `descripcion_corta` (minus the
// trailing diet-tag clause after the first comma) shares a common prefix —
// the base-dish clause every sibling repeats — followed by a per-row
// differentiator clause. Diffing the group's descriptions word-by-word
// isolates that differentiator without parsing Spanish connector grammar,
// which also means it never inherits the still-unfixed "con y"/"y con"
// dangling-connector bug elsewhere in `descripcion_corta` (out of scope here
// — that bug lives entirely inside the shared prefix, so it's never part of
// what gets appended to `nombre`). The new `nombre` = original `nombre` +
// " " + that differentiator clause, verbatim.
//
// Not every `nombre` collision in prod is this bug: some are two
// independently hand-authored recipes that happen to share a well-known
// dish name (free prose, no diet-tag clause) — diffing those the same way
// would bolt a whole sentence onto `nombre`. Every row in a group must
// carry the generator's ", apta ..." diet-tag marker or the whole group is
// left untouched for manual review (`deriveDifferentiatedNames` returns
// `[]`), same as any other unresolved case.
//
// Usage:
//   bun scripts/backfill-recipe-name-differentiator.ts              # dry-run, logs id | before -> after
//   bun scripts/backfill-recipe-name-differentiator.ts --apply       # writes changed rows via service_role

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');
const PAGE_SIZE = 500;

// Connector words that may sit at the end of the group's shared prefix —
// trimmed back into each row's remainder so the differentiator keeps its
// own leading connector (otherwise e.g. "... con" | "lima" would lose the
// "con" that makes the appended clause read correctly).
const CONNECTOR_WORDS = new Set(['con', 'y', 'de', 'al']);

export interface RecipeNameRow {
  id: string
  nombre: string
  descripcionCorta: string
}

export interface DifferentiatedName {
  id: string
  nombre: string
  newNombre: string
}

function tokenize(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

// The part of `descripcion_corta` before the diet-tag trailer, e.g.
// "Wok con tamari y jengibre con lima, apta vegana, sin gluten..." ->
// "Wok con tamari y jengibre con lima".
function headline(descripcionCorta: string): string {
  return descripcionCorta.split(',')[0]?.trim() ?? '';
}

function commonPrefixLength(tokenLists: string[][]): number {
  const minLen = Math.min(...tokenLists.map(tokens => tokens.length));
  let i = 0;
  for (; i < minLen; i++) {
    const word = tokenLists[0][i].toLowerCase();
    if (!tokenLists.every(tokens => tokens[i].toLowerCase() === word)) { break; }
  }
  return i;
}

// The generator's diet-tag trailer (", apta vegana, sin gluten..."). Some
// `nombre` collisions in prod are NOT generator output at all — two
// independently hand-authored recipes for the same well-known dish (e.g.
// two different "Fabada asturiana" write-ups, each free prose with no diet
// clause). Diffing free prose the same way produces garbage (a whole
// second sentence bolted onto `nombre`). This marker is how a row
// self-identifies as generator output; its absence on ANY row in the group
// means the group isn't the FRESCO-524 bug at all — out of scope here.
const GENERATOR_DIET_TAG = /,\s*apta\s/i;

// Derives a disambiguated `nombre` per row in a duplicate-`nombre` group.
// Returns [] when the group cannot be safely and fully resolved (not
// generator-shaped, a row with no remainder to append, or two rows deriving
// the same new name) — the caller then leaves the whole group untouched for
// manual review rather than partially renaming siblings.
export function deriveDifferentiatedNames(group: RecipeNameRow[]): DifferentiatedName[] {
  if (group.length < 2) { return []; }
  if (!group.every(row => GENERATOR_DIET_TAG.test(row.descripcionCorta))) { return []; }

  const tokenLists = group.map(row => tokenize(headline(row.descripcionCorta)));
  let prefixLen = commonPrefixLength(tokenLists);
  while (prefixLen > 0 && CONNECTOR_WORDS.has(tokenLists[0][prefixLen - 1].toLowerCase())) {
    prefixLen--;
  }

  const results: DifferentiatedName[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < group.length; i++) {
    const row = group[i];
    const remainder = tokenLists[i].slice(prefixLen).join(' ').trim();
    if (!remainder) { return []; }
    const newNombre = `${row.nombre} ${remainder}`.replace(/\s+/g, ' ').trim();
    const key = newNombre.toLowerCase();
    if (seen.has(key)) { return []; }
    seen.add(key);
    results.push({ id: row.id, nombre: row.nombre, newNombre });
  }
  return results;
}

interface RecipeRow {
  id: string
  nombre: string
  descripcion_corta: string
}

async function fetchActiveRecipes(supabaseUrl: string, serviceRoleKey: string): Promise<RecipeRow[]> {
  const all: RecipeRow[] = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/recipes?select=id,nombre,descripcion_corta&activo=eq.true&order=id&offset=${offset}&limit=${PAGE_SIZE}`,
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

async function applyUpdate(supabaseUrl: string, serviceRoleKey: string, id: string, nombre: string): Promise<void> {
  const res = await fetch(`${supabaseUrl}/rest/v1/recipes?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ nombre }),
  });
  if (!res.ok) {
    throw new Error(`Update failed for id=${id}: ${res.status} ${await res.text()}`);
  }
}

function groupByNombre(recipes: RecipeRow[]): Map<string, RecipeRow[]> {
  const groups = new Map<string, RecipeRow[]>();
  for (const recipe of recipes) {
    const bucket = groups.get(recipe.nombre);
    if (bucket) {
      bucket.push(recipe);
    }
    else {
      groups.set(recipe.nombre, [recipe]);
    }
  }
  return groups;
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY in env.');
    process.exit(1);
  }

  console.error(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  const recipes = await fetchActiveRecipes(SUPABASE_URL, SERVICE_ROLE_KEY);
  console.error(`Fetched ${recipes.length} active recipes.`);

  const groups = groupByNombre(recipes);
  const duplicateGroups = [...groups.values()].filter(group => group.length > 1);
  console.error(`Found ${duplicateGroups.length} duplicate-nombre groups (${duplicateGroups.reduce((n, g) => n + g.length, 0)} rows).`);

  let changed = 0;
  let unresolvedGroups = 0;
  let totalRows = 0;
  for (const group of duplicateGroups) {
    totalRows += group.length;
    const input: RecipeNameRow[] = group.map(row => ({
      id: row.id,
      nombre: row.nombre,
      descripcionCorta: row.descripcion_corta,
    }));
    const resolved = deriveDifferentiatedNames(input);
    if (resolved.length === 0) {
      unresolvedGroups++;
      console.error(`UNRESOLVED (manual review needed): "${group[0].nombre}" (${group.length} rows)`);
      continue;
    }
    for (const { id, nombre, newNombre } of resolved) {
      changed++;
      console.log(`${id} | ${nombre} -> ${newNombre}`);
      if (APPLY) {
        await applyUpdate(SUPABASE_URL, SERVICE_ROLE_KEY, id, newNombre);
      }
    }
  }
  console.error(
    `${changed}/${totalRows} rows changed across ${duplicateGroups.length - unresolvedGroups}/${duplicateGroups.length} groups`
    + `${unresolvedGroups > 0 ? ` (${unresolvedGroups} group(s) left for manual review)` : ''}.`
    + `${APPLY ? ' Applied.' : ' Dry-run only — pass --apply to write.'}`,
  );
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
