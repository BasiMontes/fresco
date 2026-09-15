#!/usr/bin/env bun

// FRESCO-520 — generator for `lib/grocery/consum-catalog.generated.ts`.
//
// Downloads (once, cached locally) matches from Consum's public, unauthenticated
// storefront API (`tienda.consum.es/api/rest/V1.0/catalog/product`) and matches
// them against Fresco's canonical g/ml-unit ingredient vocabulary
// (`BASE_QUANTITIES`). Matching heuristic mirrors `gen-mercadona-catalog.ts`
// (FRESCO-503): word-boundary match, "term is the product's first word"
// tie-break, reuses `retail-packs.ts`'s `SYNONYM_OVERRIDE` table.
//
// Diverges from Mercadona in TWO ways, both verified empirically 2026-09-15
// against the live API (see FRESCO-346 comment for the raw findings):
//
// 1. No structured pack-size field (`productData.format` is always empty).
//    Pack size is parsed from `productData.description` free text instead —
//    always ends with the quantity ("Leche Semidesnatada Brik 1 L",
//    "Arroz Basmati Vaso Pack de 2 2 x 125 Gr"). `priceData.centUnitAmount`
//    is NOT used for this: its reference unit silently varies per product
//    (kg for most, per-100g for low-priced-per-gram items like spices, with
//    no field flagging which), so deriving pack size from it would be off by
//    10x for a subset of products.
// 2. Per-term search (`?q=<term>`) instead of a full category-tree crawl —
//    Consum's search is relevance-ranked and reliable for every term tried
//    today, and a full-catalog walk isn't needed when every canonical
//    ingredient already has 1-3 known search terms (`clave` +
//    `SYNONYM_OVERRIDE`). Far fewer HTTP requests than a full crawl.
//
// Restricted to g/ml-unit ingredients only (Decision 2 / story Out of
// Scope): count-based units keep the hand-curated `retail-packs.ts` tables
// untouched.
//
// Nothing on the request path fetches the network — the emitted table is a
// static, committed artifact. Regenerate:
//   bun scripts/gen-consum-catalog.ts
// Drift is caught by lib/grocery/consum-catalog.test.ts (its drift check is
// skipped, not failed, when the local cache is absent — see that file's
// header comment).

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { SYNONYM_OVERRIDE } from '../lib/grocery/retail-packs.ts';
import { normalizeNombre } from '../lib/text/normalize-nombre.ts';
import { BASE_QUANTITIES } from '../supabase/functions/generate-shopping-list/consolidator.ts';

export const CACHE_DIR = new URL('.cache/consum-catalog/', import.meta.url);
const API_BASE = 'https://tienda.consum.es/api/rest/V1.0/catalog/product';
const CONSUM_HEADERS: Record<string, string> = {
  'x-tol-zone': '0',
  'x-tol-channel': '1',
  'x-tol-locale': 'es',
  'x-tol-app': 'shop-front',
  'x-tol-shipping-zone': '0D',
  'x-tol-currency': 'EUR',
  'accept': 'application/json',
  'user-agent': 'Mozilla/5.0',
};

/** The subset of Consum's real product shape this script reads (verified 2026-09-15 against live payloads). */
export interface ConsumProduct {
  ean: string
  code: string
  productData: {
    name: string
    description: string
    url: string
  }
  priceData: {
    prices: { value: { centAmount: number } }[]
  }
}

export interface ConsumMatch {
  envaseVenta: { cantidad: number, unidad: string }
  precioConsum: { precio: number }
  url: string
}

interface ParsedSize { cantidad: number, unidad: 'g' | 'ml' }

const UNIT_TO_BASE: Record<string, { unidad: 'g' | 'ml', factor: number }> = {
  kg: { unidad: 'g', factor: 1000 },
  gr: { unidad: 'g', factor: 1 },
  g: { unidad: 'g', factor: 1 },
  l: { unidad: 'ml', factor: 1000 },
  ml: { unidad: 'ml', factor: 1 },
  cl: { unidad: 'ml', factor: 10 },
};

const MULTI_PACK_RE = /(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*(kg|gr|g|l|ml|cl)\s*$/i;
const SINGLE_PACK_RE = /(\d+(?:[.,]\d+)?)\s*(kg|gr|g|l|ml|cl)\s*$/i;

function toNumber(s: string): number {
  return Number.parseFloat(s.replace(',', '.'));
}

/**
 * Extracts the retail pack size from a Consum product description. Consum
 * carries no structured size field, so this is the only source — see the
 * file header. Loose/weighed produce with no quantity in the description
 * (e.g. "Manzana Royal Gala") correctly returns null.
 */
export function parsePackSize(description: string): ParsedSize | null {
  const trimmed = description.trim();
  const multi = MULTI_PACK_RE.exec(trimmed);
  if (multi) {
    const count = toNumber(multi[1]);
    const perUnit = toNumber(multi[2]);
    const unitInfo = UNIT_TO_BASE[multi[3].toLowerCase()];
    if (!unitInfo || !(count > 0) || !(perUnit > 0)) { return null; }
    const cantidad = Math.round(count * perUnit * unitInfo.factor);
    if (cantidad <= 0) { return null; }
    return { cantidad, unidad: unitInfo.unidad };
  }
  const single = SINGLE_PACK_RE.exec(trimmed);
  if (single) {
    const qty = toNumber(single[1]);
    const unitInfo = UNIT_TO_BASE[single[2].toLowerCase()];
    if (!unitInfo || !(qty > 0)) { return null; }
    const cantidad = Math.round(qty * unitInfo.factor);
    if (cantidad <= 0) { return null; }
    return { cantidad, unidad: unitInfo.unidad };
  }
  return null;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

/**
 * Max multiple of the recipe's own portion a matched pack may weigh/hold
 * before it's rejected as implausible — same guard and same ratio as
 * `gen-mercadona-catalog.ts` (Stage 3 review fix on that story).
 */
const MAX_PACK_TO_PORTION_RATIO = 20;

function matchOneTerm(
  term: string,
  candidates: ConsumProduct[],
  targetUnit: 'g' | 'ml',
  portionInTargetUnit: number,
): { product: ConsumProduct, size: ParsedSize } | null {
  const needle = normalize(term);
  if (!needle) { return null; }
  const wordBoundary = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  const eligible: { product: ConsumProduct, size: ParsedSize }[] = [];
  for (const p of candidates) {
    if (!wordBoundary.test(normalize(p.productData.name))) { continue; }
    const size = parsePackSize(p.productData.description);
    if (!size || size.unidad !== targetUnit) { continue; }
    const precio = p.priceData.prices[0]?.value.centAmount;
    if (!(precio > 0)) { continue; }
    if (size.cantidad > portionInTargetUnit * MAX_PACK_TO_PORTION_RATIO) { continue; }
    eligible.push({ product: p, size });
  }
  if (eligible.length === 0) { return null; }
  // Consum names products "<core noun> <descriptor> <brand>", same signal
  // FRESCO-503 found for Mercadona: first-word match beats raw name length.
  const startsWithTerm = (p: ConsumProduct) => normalize(p.productData.name).startsWith(needle);
  eligible.sort((a, b) => {
    const aStarts = startsWithTerm(a.product) ? 0 : 1;
    const bStarts = startsWithTerm(b.product) ? 0 : 1;
    if (aStarts !== bStarts) { return aStarts - bStarts; }
    const aLen = a.product.productData.name.length;
    const bLen = b.product.productData.name.length;
    if (aLen !== bLen) { return aLen - bLen; }
    return a.size.cantidad - b.size.cantidad;
  });
  return eligible[0];
}

/** Canonical term first, then each `SYNONYM_OVERRIDE` alternate — first match wins. */
function findBestMatch(
  candidatesByTerm: Map<string, ConsumProduct[]>,
  clave: string,
  targetUnit: 'g' | 'ml',
  portionInTargetUnit: number,
): { product: ConsumProduct, size: ParsedSize } | null {
  const terms = [clave, ...(SYNONYM_OVERRIDE[clave] ?? [])];
  for (const term of terms) {
    const candidates = candidatesByTerm.get(term) ?? [];
    const match = matchOneTerm(term, candidates, targetUnit, portionInTargetUnit);
    if (match) { return match; }
  }
  return null;
}

/**
 * Pure matcher: given pre-fetched candidates per search term + the recipe-
 * portion table, returns the generated lookup table. No I/O — safe to unit
 * test with a small inline fixture map.
 */
export function buildConsumCatalogMatch(
  candidatesByTerm: Map<string, ConsumProduct[]>,
  porciones: Record<string, { cantidad: number, unidad: string }>,
): Record<string, ConsumMatch> {
  const out: Record<string, ConsumMatch> = {};
  for (const clave of Object.keys(porciones).sort((a, b) => a.localeCompare(b, 'es'))) {
    const unidad = porciones[clave].unidad;
    if (unidad !== 'g' && unidad !== 'ml') { continue; } // count-based unit — out of scope (Decision 2)

    const match = findBestMatch(candidatesByTerm, normalizeNombre(clave), unidad, porciones[clave].cantidad);
    if (!match) { continue; } // no catalog equivalent (or none within a plausible pack size) — absent from the table, never a placeholder

    out[clave] = {
      envaseVenta: { cantidad: match.size.cantidad, unidad: match.size.unidad },
      precioConsum: { precio: match.product.priceData.prices[0].value.centAmount },
      url: match.product.productData.url,
    };
  }
  return out;
}

async function cachedFetchTerm(term: string): Promise<ConsumProduct[]> {
  await mkdir(CACHE_DIR, { recursive: true });
  const cachePath = new URL(`${encodeURIComponent(term)}.json`, CACHE_DIR);
  if (existsSync(cachePath)) {
    return JSON.parse(await readFile(cachePath, 'utf8'));
  }
  const url = `${API_BASE}?page=1&limit=30&offset=0&q=${encodeURIComponent(term)}`;
  const res = await fetch(url, { headers: CONSUM_HEADERS });
  if (!res.ok) { throw new Error(`fetch "${term}" failed: ${res.status}`); }
  const json = await res.json() as { products?: ConsumProduct[] };
  const products = json.products ?? [];
  await writeFile(cachePath, JSON.stringify(products));
  return products;
}

/** Fetches every distinct search term across all g/ml-unit ingredients (canonical + synonyms), modest concurrency. */
async function fetchAllCandidates(
  porciones: Record<string, { cantidad: number, unidad: string }>,
): Promise<Map<string, ConsumProduct[]>> {
  const terms = new Set<string>();
  for (const clave of Object.keys(porciones)) {
    if (porciones[clave].unidad !== 'g' && porciones[clave].unidad !== 'ml') { continue; }
    const normalized = normalizeNombre(clave);
    terms.add(normalized);
    for (const syn of SYNONYM_OVERRIDE[normalized] ?? []) { terms.add(syn); }
  }
  const result = new Map<string, ConsumProduct[]>();
  const queue = [...terms];
  const concurrency = 6;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (queue.length) {
        const term = queue.shift()!;
        try {
          result.set(term, await cachedFetchTerm(term));
        }
        catch {
          result.set(term, []); // a single failed term degrades to "no match", never aborts the whole run
        }
      }
    }),
  );
  return result;
}

export function renderFile(match: Record<string, ConsumMatch>): string {
  const entries = Object.entries(match)
    .map(([clave, m]) => `  ${JSON.stringify(clave)}: ${JSON.stringify(m)},`)
    .join('\n');
  return `// GENERATED by scripts/gen-consum-catalog.ts — do not edit by hand.
// Source: Consum's public storefront API (tienda.consum.es), matched against
// Fresco's canonical g/ml-unit ingredient vocabulary. Regenerate:
// bun scripts/gen-consum-catalog.ts
// Drift is caught by lib/grocery/consum-catalog.test.ts.

import type { EnvaseVenta, PrecioConsum } from './types';

export interface ConsumMatch {
  envaseVenta: EnvaseVenta
  precioConsum: PrecioConsum
  url: string
}

/** Real Consum pack size + price, keyed by the same normalized canonical key as RETAIL_PACK_OVERRIDE. */
export const CONSUM_CATALOG_MATCH: Record<string, ConsumMatch> = {
${entries}
};
`;
}

if (import.meta.main) {
  console.log('Searching Consum catalog (cached locally on first run)...');
  const candidatesByTerm = await fetchAllCandidates(BASE_QUANTITIES);
  const match = buildConsumCatalogMatch(candidatesByTerm, BASE_QUANTITIES);
  const target = new URL('../lib/grocery/consum-catalog.generated.ts', import.meta.url);
  await Bun.write(target, renderFile(match));
  console.log(
    `Matched ${Object.keys(match).length} ingredients against ${candidatesByTerm.size} search terms.`,
  );
}
