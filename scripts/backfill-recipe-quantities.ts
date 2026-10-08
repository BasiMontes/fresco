#!/usr/bin/env bun

// FRESCO-863 (ADR-0042) — backfill `recipes.ingredientes_cantidades` for the
// active catalog. The quantities are AI estimates, so this script never invents
// them: it hands recipes out in batches, then validates what comes back and only
// writes what passes. Three steps:
//
//   1. export  — write batch files of active recipes that still have no
//                quantities (id, nombre, raciones, ingredientes, pasos).
//   2. (an AI pass fills each batch: [{ id, ingredientes_cantidades: [...] }])
//   3. check   — validate the filled files; prints every rejection and warning.
//      apply   — same check, then PATCH only the recipes that passed.
//
// Usage:
//   bun scripts/backfill-recipe-quantities.ts export <outDir> [--size 25]
//   bun scripts/backfill-recipe-quantities.ts check <file...>           # dry-run (reads the catalog, writes nothing)
//   bun scripts/backfill-recipe-quantities.ts apply <file...> --apply   # writes via service_role
//
// `apply` without `--apply` is the same dry run. Writes are filtered with
// `ingredientes_cantidades=is.null`, so a recipe that already has quantities is
// never overwritten. The DB check (recipes_ingredientes_cantidades_valid) is the
// second line of defence behind this validator.

import { mkdir } from 'node:fs/promises';

export const UNIDADES = ['g', 'ml', 'unidades', 'dientes', 'cucharadas', 'cucharaditas', 'pizca', 'al gusto'] as const;
export type Unidad = (typeof UNIDADES)[number];

export interface Quantity {
  nombre: string
  cantidad: number
  unidad: Unidad
}

export interface RecipeForQuantities {
  id: string
  nombre: string
  raciones: number
  ingredientes: string[]
}

export interface QuantityCheck {
  problems: string[]
  warnings: string[]
}

const RACIONES_POR_DEFECTO = 4;

// Upper bound per serving, by unit. `pizca` is a total (it never scales with the
// number of servings). Chosen loose on purpose: the point is to catch a unit slip
// (grams written as millilitres of a whole bottle, 40 garlic cloves), not to
// second-guess a generous recipe.
const MAX_PER_SERVING: Record<Exclude<Unidad, 'al gusto' | 'pizca'>, number> = {
  g: 500,
  ml: 700,
  unidades: 4,
  dientes: 3,
  cucharadas: 3,
  cucharaditas: 3,
};
const MAX_PIZCA_TOTAL = 3;
const MIN_CANTIDAD = 0.5;

// Combined g + ml per serving outside this range is suspicious but not wrong by
// itself (a salad is light, a stew heavy), so it is a warning, not a rejection.
const WARN_GRAMS_PER_SERVING: [number, number] = [120, 1100];

function isQuantityShape(value: unknown): value is Quantity {
  if (typeof value !== 'object' || value === null) { return false; }
  const q = value as Record<string, unknown>;
  return typeof q.nombre === 'string'
    && typeof q.cantidad === 'number'
    && Number.isFinite(q.cantidad)
    && typeof q.unidad === 'string';
}

export function checkQuantities(recipe: RecipeForQuantities, quantities: unknown): QuantityCheck {
  const problems: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(quantities) || quantities.length === 0) {
    return { problems: ['quantities is not a non-empty array'], warnings };
  }

  const raciones = recipe.raciones > 0 ? recipe.raciones : RACIONES_POR_DEFECTO;
  const seen = new Set<string>();
  let gramsPerServing = 0;

  for (const entry of quantities as unknown[]) {
    if (!isQuantityShape(entry)) {
      problems.push(`malformed entry ${JSON.stringify(entry)}`);
      continue;
    }
    const { nombre, cantidad, unidad } = entry;

    if (!(UNIDADES as readonly string[]).includes(unidad)) {
      problems.push(`${nombre}: unit "${unidad}" is not in the closed list`);
      continue;
    }
    if (seen.has(nombre)) { problems.push(`${nombre}: listed more than once`); }
    seen.add(nombre);
    if (!recipe.ingredientes.includes(nombre)) {
      problems.push(`${nombre}: not in ingredientes_principales`);
    }

    if (unidad === 'al gusto') { continue; }
    if (cantidad < MIN_CANTIDAD) {
      problems.push(`${nombre}: ${cantidad} ${unidad} is below ${MIN_CANTIDAD}`);
      continue;
    }
    if (unidad === 'pizca') {
      if (cantidad > MAX_PIZCA_TOTAL) { problems.push(`${nombre}: ${cantidad} pizcas is above ${MAX_PIZCA_TOTAL}`); }
      continue;
    }
    const perServing = cantidad / raciones;
    if (perServing > MAX_PER_SERVING[unidad]) {
      problems.push(`${nombre}: ${cantidad} ${unidad} for ${raciones} servings is ${perServing.toFixed(1)} per serving, above ${MAX_PER_SERVING[unidad]}`);
    }
    if (unidad === 'g' || unidad === 'ml') { gramsPerServing += perServing; }
  }

  for (const nombre of recipe.ingredientes) {
    if (!seen.has(nombre)) { problems.push(`${nombre}: missing`); }
  }

  if (problems.length === 0 && (gramsPerServing < WARN_GRAMS_PER_SERVING[0] || gramsPerServing > WARN_GRAMS_PER_SERVING[1])) {
    warnings.push(`${gramsPerServing.toFixed(0)} g+ml per serving is outside ${WARN_GRAMS_PER_SERVING[0]}-${WARN_GRAMS_PER_SERVING[1]}`);
  }

  return { problems, warnings };
}

interface FilledRecipe {
  id: string
  ingredientes_cantidades: unknown
}

interface RecipeRow {
  id: string
  nombre: string
  meta: { raciones?: number } | null
  ingredientes_principales: string[] | null
  pasos_resumen: string[] | null
}

const PAGE_SIZE = 500;

function authHeaders(serviceRoleKey: string): Record<string, string> {
  return { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
}

function requireEnv(): { url: string, key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY in env.');
    process.exit(1);
  }
  return { url, key };
}

async function fetchRecipes(url: string, key: string, filter: string): Promise<RecipeRow[]> {
  const all: RecipeRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const res = await fetch(
      `${url}/rest/v1/recipes?select=id,nombre,meta,ingredientes_principales,pasos_resumen&${filter}&order=id&offset=${offset}&limit=${PAGE_SIZE}`,
      { headers: authHeaders(key) },
    );
    if (!res.ok) { throw new Error(`Fetch failed (offset=${offset}): ${res.status} ${await res.text()}`); }
    const page = (await res.json()) as RecipeRow[];
    all.push(...page);
    if (page.length < PAGE_SIZE) { break; }
  }
  return all;
}

function toRecipeForQuantities(row: RecipeRow): RecipeForQuantities {
  return {
    id: row.id,
    nombre: row.nombre,
    raciones: row.meta?.raciones ?? 0,
    ingredientes: row.ingredientes_principales ?? [],
  };
}

async function runExport(outDir: string, size: number): Promise<void> {
  const { url, key } = requireEnv();
  const rows = await fetchRecipes(url, key, 'activo=eq.true&ingredientes_cantidades=is.null');
  await mkdir(outDir, { recursive: true });

  const batches = Math.ceil(rows.length / size);
  for (let i = 0; i < batches; i++) {
    const batch = rows.slice(i * size, (i + 1) * size).map(row => ({
      ...toRecipeForQuantities(row),
      pasos: row.pasos_resumen ?? [],
    }));
    await Bun.write(`${outDir}/batch-${String(i + 1).padStart(3, '0')}.json`, `${JSON.stringify(batch, null, 2)}\n`);
  }
  console.error(`Exported ${rows.length} recipes into ${batches} batch files in ${outDir}.`);
}

async function runCheck(files: string[], apply: boolean): Promise<void> {
  const { url, key } = requireEnv();
  const rows = await fetchRecipes(url, key, 'activo=eq.true');
  const byId = new Map(rows.map(row => [row.id, toRecipeForQuantities(row)]));

  let ok = 0;
  let rejected = 0;
  let written = 0;
  for (const file of files) {
    const filled = (await Bun.file(file).json()) as FilledRecipe[];
    for (const item of filled) {
      const recipe = byId.get(item.id);
      if (!recipe) {
        console.log(`REJECT ${item.id} | not an active recipe`);
        rejected++;
        continue;
      }
      const { problems, warnings } = checkQuantities(recipe, item.ingredientes_cantidades);
      if (problems.length > 0) {
        console.log(`REJECT ${item.id} | ${recipe.nombre} | ${problems.join('; ')}`);
        rejected++;
        continue;
      }
      for (const warning of warnings) { console.log(`WARN   ${item.id} | ${recipe.nombre} | ${warning}`); }
      ok++;
      if (apply) {
        await patchQuantities(url, key, item.id, item.ingredientes_cantidades as Quantity[]);
        written++;
      }
    }
  }
  console.error(`${apply ? 'APPLY' : 'DRY-RUN'}: ${ok} valid, ${rejected} rejected${apply ? `, ${written} written` : ''}.`);
}

async function patchQuantities(url: string, key: string, id: string, quantities: Quantity[]): Promise<void> {
  const res = await fetch(`${url}/rest/v1/recipes?id=eq.${id}&ingredientes_cantidades=is.null`, {
    method: 'PATCH',
    headers: { ...authHeaders(key), 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({ ingredientes_cantidades: quantities }),
  });
  if (!res.ok) { throw new Error(`Update failed for id=${id}: ${res.status} ${await res.text()}`); }
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const args = rest.filter(arg => !arg.startsWith('--'));

  if (command === 'export' && args[0]) {
    const sizeFlag = rest.indexOf('--size');
    const size = sizeFlag >= 0 ? Number(rest[sizeFlag + 1]) : 25;
    // `--size 25` leaves "25" among the positionals; the output dir is always first.
    await runExport(args[0], Number.isInteger(size) && size > 0 ? size : 25);
  }
  else if ((command === 'check' || command === 'apply') && args.length > 0) {
    await runCheck(args, command === 'apply' && rest.includes('--apply'));
  }
  else {
    console.error('Usage: backfill-recipe-quantities.ts export <outDir> [--size N] | check <file...> | apply <file...> --apply');
    process.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
