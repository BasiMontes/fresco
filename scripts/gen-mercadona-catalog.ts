#!/usr/bin/env bun

// FRESCO-503 — generator for `lib/grocery/mercadona-catalog.generated.ts`.
//
// Downloads (once, cached locally) the free `datania/mercadona-catalog`
// Hugging Face dataset (MIT, community-maintained weekly export of
// Mercadona's own unofficial JSON API — the story's Business Rules record
// the founder's explicit acceptance of that ToS gray-zone risk) and matches
// it against Fresco's canonical g/ml-unit ingredient vocabulary
// (`BASE_QUANTITIES`). Matching heuristic ported from the FRESCO-488 spike
// (`scripts/spikes/fresco-488-mercadona-catalog-match/prototype.ts`):
// word-boundary match against `display_name`, "term is the product's first
// word" tie-break, reusing `retail-packs.ts`'s `SYNONYM_OVERRIDE` table
// (Decision 3 of the Stage 1 plan) instead of a second synonym table.
//
// Restricted to g/ml-unit ingredients only (Decision 2 / story Out of
// Scope): count-based units (`unidades`, `dientes`, `rebanadas`, ...) keep
// the hand-curated `retail-packs.ts` tables untouched.
//
// Nothing on the request path fetches the network — the emitted table is a
// static, committed artifact (Decision 1). Regenerate:
//   bun scripts/gen-mercadona-catalog.ts
// Drift is caught by lib/grocery/mercadona-catalog.test.ts (its drift check
// is skipped, not failed, when the local HF cache is absent — see that
// file's header comment).

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { SYNONYM_OVERRIDE } from '../lib/grocery/retail-packs.ts';
import { normalizeNombre } from '../lib/text/normalize-nombre.ts';
import { BASE_QUANTITIES } from '../supabase/functions/generate-shopping-list/consolidator.ts';

export const CACHE_DIR = new URL('.cache/mercadona-catalog/', import.meta.url);
const HF_BASE = 'https://huggingface.co/datasets/datania/mercadona-catalog/resolve/main';

/**
 * The subset of Mercadona's real product shape this script reads. Field
 * names verified 2026-09-14 against live cached payloads (Stage 1 plan Risk
 * 2) — `unit_size` is expressed in `size_format`'s unit (kg or l), NOT
 * directly in g/ml: e.g. `{ unit_size: 0.45, size_format: 'kg' }` is a 450 g
 * pack. `reference_price` is EUR per one `reference_format` unit (usually
 * matches `size_format` but can differ, e.g. "100 g" pricing on a "kg"-sized
 * product) — kept as-is for downstream consumers (FRESCO-340), not
 * normalized here.
 */
export interface MercadonaProduct {
  id: string
  display_name: string
  price_instructions: {
    reference_price: string
    reference_format: string
    unit_size: number | null
    size_format: string | null
  }
}

interface MercadonaCategory {
  id: number
  categories?: MercadonaCategory[]
  products?: MercadonaProduct[]
}

export interface MercadonaMatch {
  envaseVenta: { cantidad: number, unidad: string }
  precioMercadona: { precioReferencia: number, formatoReferencia: string }
}

const NOT_FOUND_MARKER = '__NOT_FOUND__';

async function cachedFetch(path: string): Promise<string> {
  await mkdir(CACHE_DIR, { recursive: true });
  const cachePath = new URL(path.replaceAll('/', '_'), CACHE_DIR);
  if (existsSync(cachePath)) {
    const cached = await readFile(cachePath, 'utf8');
    if (cached === NOT_FOUND_MARKER) { throw new Error(`fetch ${path} failed: 404 (cached)`); }
    return cached;
  }
  const res = await fetch(`${HF_BASE}/${path}`);
  if (!res.ok) {
    // Cache 404s too (e.g. layout-only category ids with no detail file) so
    // a re-run doesn't re-hit the network for the same permanent miss.
    if (res.status === 404) { await writeFile(cachePath, NOT_FOUND_MARKER); }
    throw new Error(`fetch ${path} failed: ${res.status}`);
  }
  const text = await res.text();
  await writeFile(cachePath, text);
  return text;
}

/** Downloads (or reads from the local cache) the full flattened product catalog. */
export async function loadCatalog(): Promise<MercadonaProduct[]> {
  const categoriesJson = JSON.parse(await cachedFetch('categories.json'));
  const ids: number[] = [];
  for (const top of categoriesJson.results) {
    ids.push(top.id);
    for (const sub of top.categories ?? []) { ids.push(sub.id); }
  }
  const products = new Map<string, MercadonaProduct>();
  const walk = (cat: MercadonaCategory) => {
    for (const p of cat.products ?? []) { products.set(p.id, p); }
    for (const sub of cat.categories ?? []) { walk(sub); }
  };
  const limit = 12;
  const queue = [...ids];
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (queue.length) {
        const id = queue.shift()!;
        try {
          const cat = JSON.parse(await cachedFetch(`categories/${id}.json`));
          walk(cat);
        }
        catch {
          // category id from the tree with no detail file (rare, layout-only nodes) — skip
        }
      }
    }),
  );
  return [...products.values()];
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

/** `porcionReceta.unidad` -> the Mercadona `size_format` it corresponds to (Decision 2: g/ml only). */
const UNIT_TO_SIZE_FORMAT: Record<string, string> = { g: 'kg', ml: 'l' };

function matchOneTerm(term: string, catalog: MercadonaProduct[], sizeFormat: string): MercadonaProduct | null {
  const needle = normalize(term);
  if (!needle) { return null; }
  const wordBoundary = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  const candidates = catalog.filter((p) => {
    const pi = p.price_instructions;
    if (pi.size_format !== sizeFormat) { return false; }
    if (!(pi.unit_size !== null && pi.unit_size > 0)) { return false; }
    if (!(Number.parseFloat(pi.reference_price) > 0)) { return false; }
    return wordBoundary.test(normalize(p.display_name));
  });
  if (candidates.length === 0) { return null; }
  // Mercadona names products "<core noun> <descriptor> <brand>", so the term
  // appearing as the FIRST word is a much stronger relevance signal than raw
  // name length (FRESCO-488 spike finding).
  const startsWithTerm = (p: MercadonaProduct) => normalize(p.display_name).startsWith(needle);
  candidates.sort((a, b) => {
    const aStarts = startsWithTerm(a) ? 0 : 1;
    const bStarts = startsWithTerm(b) ? 0 : 1;
    if (aStarts !== bStarts) { return aStarts - bStarts; }
    if (a.display_name.length !== b.display_name.length) { return a.display_name.length - b.display_name.length; }
    // Same display name (single bottle vs. multi-buy pack share it, e.g.
    // "Leche entera Hacendado" at 1L and at 6L) — prefer the smaller pack,
    // the size a shopper more plausibly wants for one recipe ingredient.
    return (a.price_instructions.unit_size ?? 0) - (b.price_instructions.unit_size ?? 0);
  });
  return candidates[0];
}

/** Canonical term first, then each `SYNONYM_OVERRIDE` alternate — first match wins (Decision 3). */
function findBestMatch(clave: string, catalog: MercadonaProduct[], sizeFormat: string): MercadonaProduct | null {
  const terms = [clave, ...(SYNONYM_OVERRIDE[clave] ?? [])];
  for (const term of terms) {
    const match = matchOneTerm(term, catalog, sizeFormat);
    if (match) { return match; }
  }
  return null;
}

/**
 * Pure matcher: given the raw catalog + the recipe-portion table, returns
 * the generated lookup table. No I/O — safe to unit test with a small
 * inline fixture catalog.
 */
export function buildMercadonaCatalogMatch(
  catalog: MercadonaProduct[],
  porciones: Record<string, { cantidad: number, unidad: string }>,
): Record<string, MercadonaMatch> {
  const out: Record<string, MercadonaMatch> = {};
  for (const clave of Object.keys(porciones).sort((a, b) => a.localeCompare(b, 'es'))) {
    const sizeFormat = UNIT_TO_SIZE_FORMAT[porciones[clave].unidad];
    if (!sizeFormat) { continue; } // count-based unit — out of scope (Decision 2)

    const match = findBestMatch(normalizeNombre(clave), catalog, sizeFormat);
    if (!match) { continue; } // no catalog equivalent — absent from the table, never a placeholder

    const pi = match.price_instructions;
    const cantidad = Math.round((pi.unit_size as number) * 1000);
    if (cantidad <= 0) { continue; } // e.g. saffron sold in sub-gram sachets — rounds to 0, never a garbage/zero pack size
    const precioReferencia = Number.parseFloat(pi.reference_price);
    out[clave] = {
      envaseVenta: { cantidad, unidad: porciones[clave].unidad },
      precioMercadona: { precioReferencia, formatoReferencia: pi.reference_format },
    };
  }
  return out;
}

export function renderFile(match: Record<string, MercadonaMatch>): string {
  const entries = Object.entries(match)
    .map(([clave, m]) => `  ${JSON.stringify(clave)}: ${JSON.stringify(m)},`)
    .join('\n');
  return `// GENERATED by scripts/gen-mercadona-catalog.ts — do not edit by hand.
// Source: the datania/mercadona-catalog Hugging Face dataset (MIT), matched
// against Fresco's canonical g/ml-unit ingredient vocabulary. Regenerate:
// bun scripts/gen-mercadona-catalog.ts
// Drift is caught by lib/grocery/mercadona-catalog.test.ts.

import type { EnvaseVenta, PrecioMercadona } from './types';

export interface MercadonaMatch {
  envaseVenta: EnvaseVenta
  precioMercadona: PrecioMercadona
}

/** Real Mercadona pack size + price, keyed by the same normalized canonical key as RETAIL_PACK_OVERRIDE. */
export const MERCADONA_CATALOG_MATCH: Record<string, MercadonaMatch> = {
${entries}
};
`;
}

if (import.meta.main) {
  console.log('Loading Mercadona catalog (cached locally on first run)...');
  const catalog = await loadCatalog();
  const match = buildMercadonaCatalogMatch(catalog, BASE_QUANTITIES);
  const target = new URL('../lib/grocery/mercadona-catalog.generated.ts', import.meta.url);
  await Bun.write(target, renderFile(match));
  console.log(
    `Matched ${Object.keys(match).length} ingredients against ${catalog.length} Mercadona products.`,
  );
}
