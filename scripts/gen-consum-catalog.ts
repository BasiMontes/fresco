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

import type { IngredienteParaMatching } from '../lib/grocery/supermarket/matcher.ts';
import type { ProductoSupermercado } from '../lib/grocery/supermarket/types.ts';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { CONSUM_CATALOG_MATCH } from '../lib/grocery/consum-catalog.generated.ts';
import { SYNONYM_OVERRIDE } from '../lib/grocery/retail-packs.ts';
import { emparejarIngrediente } from '../lib/grocery/supermarket/matcher.ts';
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
  categories?: { name: string }[]
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

/**
 * FRESCO-1244 — products chosen by hand, for the ingredients where the heuristic picks something else (cake
 * sprinkles for "fideos", a skyr product for "espinacas"). A pinned product wins over the published one and over
 * the heuristic. Keys are the normalized canonical keys of `BASE_QUANTITIES`; values are Consum product codes.
 * When Consum no longer has a pinned product, the key follows the normal order (published, heuristic), so the
 * refresh lists the change for review.
 */
export const PRODUCTOS_FIJADOS: Readonly<Record<string, string>> = {
  'espinacas': '7054273', // Espinacas bolsa 300 g
  'fideos': '7060606', // Fideos medianos paquete 500 g
  'vino blanco': '7331812', // Vino blanco D.O. Rioja 750 ml
};

/** The matcher ignores the observation instant; a fixed one keeps the build deterministic. */
const OBSERVADO_EN = new Date(0).toISOString();

/** FRESCO-1244: Consum's takeaway shelf ("Pollo Mediterráneo", a 280 g ready meal) never stands for an ingredient. */
const CATEGORIA_PLATOS_PREPARADOS = 'Platos para llevar';

/**
 * One Consum product as the common shape, or `null` when it cannot be priced
 * faithfully (no pack size in the description, or no price) or is a ready meal.
 * Consum prices the whole pack, so the price passes through.
 */
function productoDeConsum(p: ConsumProduct): ProductoSupermercado | null {
  const envase = parsePackSize(p.productData.description);
  const precioEnvase = p.priceData.prices[0]?.value.centAmount;
  if (!envase || !(precioEnvase > 0)) { return null; }
  if (p.categories?.some(c => c.name === CATEGORIA_PLATOS_PREPARADOS)) { return null; }
  return {
    cadena: 'consum',
    idExterno: p.code,
    nombre: p.productData.name,
    marca: null,
    envase,
    precioEnvase,
    url: p.productData.url,
    disponible: true,
    zona: 'default',
    observadoEn: OBSERVADO_EN,
  };
}

/** The product code is the last segment of a Consum product URL; the slug before it changes when a product is renamed. */
function codigoDeUrl(url: string): string {
  return url.slice(url.lastIndexOf('/') + 1);
}

export interface OpcionesDeMatch {
  /** The committed catalog: its product stays for an ingredient while it is sold and passes the matching rules. */
  anterior?: Record<string, ConsumMatch>
  fijados?: Readonly<Record<string, string>>
}

/** The search terms of an ingredient: the canonical one first, then each `SYNONYM_OVERRIDE` alternate (Decision 3). */
function terminosDe(clave: string): string[] {
  const normalizada = normalizeNombre(clave);
  return [normalizada, ...(SYNONYM_OVERRIDE[normalizada] ?? [])];
}

/**
 * FRESCO-1244 — the pinned and published products the searches did not return. A search lists 30 products by
 * relevance, so one that is still sold can drop out of it; the run asks for these by code before matching.
 */
export function codigosAusentes(
  candidatesByTerm: Map<string, ConsumProduct[]>,
  porciones: Record<string, { cantidad: number, unidad: string }>,
  { anterior = {}, fijados = PRODUCTOS_FIJADOS }: OpcionesDeMatch = {},
): { termino: string, codigo: string }[] {
  return Object.keys(porciones).flatMap((clave) => {
    const { unidad } = porciones[clave];
    if (unidad !== 'g' && unidad !== 'ml') { return []; }
    const terminos = terminosDe(clave);
    const listados = new Set(terminos.flatMap(t => candidatesByTerm.get(t) ?? []).map(p => p.code));
    const queridos = [fijados[clave], anterior[clave] && codigoDeUrl(anterior[clave].url)];
    return [...new Set(queridos)]
      .filter((codigo): codigo is string => !!codigo && !listados.has(codigo))
      .map(codigo => ({ termino: terminos[0], codigo }));
  });
}

/**
 * Pure matcher: given pre-fetched candidates per search term + the recipe-
 * portion table, returns the generated lookup table. No I/O — safe to unit
 * test with a small inline fixture map.
 *
 * FRESCO-1244, in order: the pinned product, the previously published one, the heuristic. Without the middle step
 * any newly listed product with a shorter name or a smaller pack took over the ingredient on the next refresh.
 */
export function buildConsumCatalogMatch(
  candidatesByTerm: Map<string, ConsumProduct[]>,
  porciones: Record<string, { cantidad: number, unidad: string }>,
  { anterior = {}, fijados = PRODUCTOS_FIJADOS }: OpcionesDeMatch = {},
): Record<string, ConsumMatch> {
  const out: Record<string, ConsumMatch> = {};
  for (const clave of Object.keys(porciones).sort((a, b) => a.localeCompare(b, 'es'))) {
    const { cantidad, unidad } = porciones[clave];
    if (unidad !== 'g' && unidad !== 'ml') { continue; } // count-based unit — out of scope (Decision 2)

    const terminos = terminosDe(clave);
    const crudos = new Map<string, ConsumProduct>();
    for (const termino of terminos) {
      for (const p of candidatesByTerm.get(termino) ?? []) { crudos.set(p.code, p); }
    }
    const candidatos = [...crudos.values()]
      .map(productoDeConsum)
      .filter((p): p is ProductoSupermercado => p !== null);

    const ingrediente: IngredienteParaMatching = { terminos, porcion: { cantidad, unidad } };
    const fijado = candidatos.find(p => p.idExterno === fijados[clave]);
    const publicado = anterior[clave] && candidatos.find(p => p.idExterno === codigoDeUrl(anterior[clave].url));
    const coincidencia = (fijado ? { producto: fijado } : null)
      // The published product alone goes through the same rules, so a rule added later still drops it.
      ?? (publicado ? emparejarIngrediente({ ingrediente, candidatos: [publicado] }) : null)
      ?? emparejarIngrediente({ ingrediente, candidatos });
    if (!coincidencia) { continue; } // no catalog equivalent (or none within a plausible pack size) — absent from the table, never a placeholder

    const match = crudos.get(coincidencia.producto.idExterno) as ConsumProduct;
    out[clave] = {
      envaseVenta: { cantidad: coincidencia.producto.envase.cantidad, unidad: coincidencia.producto.envase.unidad },
      precioConsum: { precio: coincidencia.producto.precioEnvase },
      url: match.productData.url,
    };
  }
  return out;
}

/**
 * FRESCO-1177 — when these prices were observed: the moment the cache was first filled, kept next to it so a
 * later run (and the drift test) reads the same instant instead of "now". A cache with no date file gets one now.
 */
export async function fechaDeCache(): Promise<string> {
  await mkdir(CACHE_DIR, { recursive: true });
  const cachePath = new URL('generated-at.txt', CACHE_DIR);
  if (existsSync(cachePath)) { return (await readFile(cachePath, 'utf8')).trim(); }
  const ahora = new Date().toISOString();
  await writeFile(cachePath, ahora);
  return ahora;
}

/**
 * FRESCO-1192 (ADR-0037): the weekly job calls Consum's storefront ourselves, so it keeps the load low: two
 * requests at a time and a pause after each one that reaches the network (a cached term costs nothing).
 */
const CONCURRENCY = 2;
const PAUSA_ENTRE_PETICIONES_MS = 300;

/** Share of search terms that may fail before a run is not trusted to replace the committed catalog. */
const MAX_FRACCION_FALLOS = 0.05;

/**
 * FRESCO-1192: a term that fails degrades to "no match", which is right for one bad answer and wrong for a
 * blocked or broken Consum, where every ingredient would lose its price in the next PR. Above this
 * share of failures (or with nothing searched) the run stops before it writes anything.
 */
export function demasiadosFallos(fallidos: number, total: number): boolean {
  return total === 0 || fallidos / total > MAX_FRACCION_FALLOS;
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
  await Bun.sleep(PAUSA_ENTRE_PETICIONES_MS);
  return products;
}

/** One product by its code, cached like a search; `null` when Consum no longer has it. */
async function cachedFetchCode(codigo: string): Promise<ConsumProduct | null> {
  await mkdir(CACHE_DIR, { recursive: true });
  const cachePath = new URL(`code-${codigo}.json`, CACHE_DIR);
  if (existsSync(cachePath)) {
    return JSON.parse(await readFile(cachePath, 'utf8'));
  }
  const res = await fetch(`${API_BASE}/code/${encodeURIComponent(codigo)}`, { headers: CONSUM_HEADERS });
  if (!res.ok && res.status !== 404) { throw new Error(`fetch product ${codigo} failed: ${res.status}`); }
  const product = res.ok ? await res.json() as ConsumProduct : null;
  await writeFile(cachePath, JSON.stringify(product));
  await Bun.sleep(PAUSA_ENTRE_PETICIONES_MS);
  return product;
}

/** Fetches every distinct search term across all g/ml-unit ingredients (canonical + synonyms), modest concurrency. */
async function fetchAllCandidates(
  porciones: Record<string, { cantidad: number, unidad: string }>,
): Promise<{ candidatos: Map<string, ConsumProduct[]>, fallidos: string[] }> {
  const terms = new Set<string>();
  for (const clave of Object.keys(porciones)) {
    if (porciones[clave].unidad !== 'g' && porciones[clave].unidad !== 'ml') { continue; }
    const normalized = normalizeNombre(clave);
    terms.add(normalized);
    for (const syn of SYNONYM_OVERRIDE[normalized] ?? []) { terms.add(syn); }
  }
  const result = new Map<string, ConsumProduct[]>();
  const queue = [...terms];
  const fallidos: string[] = [];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const term = queue.shift()!;
        try {
          result.set(term, await cachedFetchTerm(term));
        }
        catch {
          fallidos.push(term);
          result.set(term, []); // a single failed term degrades to "no match"; too many stop the run in main (FRESCO-1192)
        }
      }
    }),
  );
  return { candidatos: result, fallidos };
}

/**
 * FRESCO-1193 — what a regeneration changed against the committed file, one line per entry, so a human
 * reviews the new and the changed products before accepting them. `+` new, `~` product changed (by
 * url), `-` gone. An identical entry is not listed.
 */
export function describirDiffCatalogo(anterior: Record<string, ConsumMatch>, nuevo: Record<string, ConsumMatch>): string[] {
  const lineas: string[] = [];
  for (const clave of Object.keys(nuevo).sort((a, b) => a.localeCompare(b, 'es'))) {
    const antes = anterior[clave];
    if (!antes) { lineas.push(`+ ${clave}: ${nuevo[clave].url}`); }
    else if (antes.url !== nuevo[clave].url) { lineas.push(`~ ${clave}: ${antes.url} -> ${nuevo[clave].url}`); }
  }
  for (const clave of Object.keys(anterior).sort((a, b) => a.localeCompare(b, 'es'))) {
    if (!nuevo[clave]) { lineas.push(`- ${clave}: ${anterior[clave].url}`); }
  }
  return lineas;
}

export function renderFile(match: Record<string, ConsumMatch>, fecha: string): string {
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

/** When these prices were observed (FRESCO-1177): the age rules read it. */
export const CONSUM_CATALOG_FECHA = '${fecha}';

/** Real Consum pack size + price, keyed by the same normalized canonical key as RETAIL_PACK_OVERRIDE. */
export const CONSUM_CATALOG_MATCH: Record<string, ConsumMatch> = {
${entries}
};
`;
}

if (import.meta.main) {
  console.log('Searching Consum catalog (cached locally on first run)...');
  const fecha = await fechaDeCache(); // before the first request: the instant the prices are read
  const { candidatos: candidatesByTerm, fallidos } = await fetchAllCandidates(BASE_QUANTITIES);
  const ausentes = codigosAusentes(candidatesByTerm, BASE_QUANTITIES, { anterior: CONSUM_CATALOG_MATCH });
  for (const { termino, codigo } of ausentes) { // one at a time: ADR-0037 keeps the load on Consum low
    try {
      const producto = await cachedFetchCode(codigo);
      if (producto) { candidatesByTerm.set(termino, [...candidatesByTerm.get(termino) ?? [], producto]); }
    }
    catch {
      fallidos.push(`${termino} (product ${codigo})`);
    }
  }
  const peticiones = candidatesByTerm.size + ausentes.length;
  if (demasiadosFallos(fallidos.length, peticiones)) {
    console.error(`${fallidos.length} of ${peticiones} Consum requests failed: not writing the catalog, the committed one stays.`);
    process.exit(1);
  }
  const match = buildConsumCatalogMatch(candidatesByTerm, BASE_QUANTITIES, { anterior: CONSUM_CATALOG_MATCH });
  const target = new URL('../lib/grocery/consum-catalog.generated.ts', import.meta.url);
  const cambios = describirDiffCatalogo(CONSUM_CATALOG_MATCH, match);
  await Bun.write(target, renderFile(match, fecha));
  console.log(
    `Matched ${Object.keys(match).length} ingredients against ${candidatesByTerm.size} search terms.`,
  );
  // FRESCO-1244: an ingredient can show as changed or gone only because a request failed, so they are named.
  if (fallidos.length > 0) { console.log(`Requests that failed (their ingredients may show as changed or gone): ${fallidos.join(', ')}`); }
  // FRESCO-1193: review these before accepting the regenerated file (+ new, ~ product changed, - gone).
  console.log(cambios.length === 0 ? 'No entries new, changed or gone against the committed file.' : `Review these ${cambios.length} changes against the committed file:\n${cambios.join('\n')}`);
}
