// FRESCO-488 spike — match Fresco's real shopping list against the free,
// weekly-refreshed Mercadona catalog dataset (datania/mercadona-catalog on
// Hugging Face) instead of the retailer's own search box.
// Throwaway. Not wired into the app. Run: bun scripts/spikes/fresco-488-mercadona-catalog-match/prototype.ts

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const DIR = import.meta.dir;
const CACHE = `${DIR}/cache`;
const HF_BASE = 'https://huggingface.co/datasets/datania/mercadona-catalog/resolve/main';

interface MercadonaProduct {
  id: string
  display_name: string
  packaging: string | null
  price_instructions: {
    unit_price: string
    reference_price: string
    reference_format: string
    unit_size: number | null
    pack_size: number | null
    total_units: number | null
    unit_name: string | null
  }
}

interface Category {
  id: number
  categories?: Category[]
  products?: MercadonaProduct[]
}

interface ShoppingListItem {
  nombre: string
  cantidad: number
  unidad: string
  precio_estimado: number
}

async function cachedFetch(path: string): Promise<string> {
  const cachePath = `${CACHE}/${path.replaceAll('/', '_')}`;
  if (existsSync(cachePath)) { return readFile(cachePath, 'utf8'); }
  const res = await fetch(`${HF_BASE}/${path}`);
  if (!res.ok) { throw new Error(`fetch ${path} failed: ${res.status}`); }
  const text = await res.text();
  await writeFile(cachePath, text);
  return text;
}

async function loadCatalog(): Promise<MercadonaProduct[]> {
  await mkdir(CACHE, { recursive: true });
  const categoriesJson = JSON.parse(await cachedFetch('categories.json'));
  const ids: number[] = [];
  for (const top of categoriesJson.results) {
    ids.push(top.id);
    for (const sub of top.categories ?? []) { ids.push(sub.id); }
  }
  const products = new Map<string, MercadonaProduct>();
  const walk = (cat: Category) => {
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

// Known Spanish regional synonyms the raw ingredient name won't match
// literally against Mercadona's own product naming. A real ingredient-
// canonicalization layer (FRESCO-488) needs a table like this; this is a
// two-entry demonstration, not the real thing.
const SYNONYMS: Record<string, string> = { boniato: 'batata' };

function findBestMatch(term: string, catalog: MercadonaProduct[]): MercadonaProduct | null {
  const needle = normalize(SYNONYMS[normalize(term)] ?? term);
  const wordBoundary = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  const candidates = catalog.filter(p => wordBoundary.test(normalize(p.display_name)));
  if (candidates.length === 0) { return null; }
  // Mercadona names products "<core noun> <descriptor> <brand>" (e.g. "Leche
  // entera Hacendado"), so the term appearing as the FIRST word is a much
  // stronger relevance signal than raw name length — "6 Panes de leche 3%"
  // is shorter than "Leche entera Hacendado" but is a bread product, not milk.
  const startsWithTerm = (p: MercadonaProduct) => normalize(p.display_name).startsWith(needle);
  candidates.sort((a, b) => {
    const aStarts = startsWithTerm(a) ? 0 : 1;
    const bStarts = startsWithTerm(b) ? 0 : 1;
    if (aStarts !== bStarts) { return aStarts - bStarts; }
    return a.display_name.length - b.display_name.length;
  });
  return candidates[0];
}

const WEIGHT_UNITS: Record<string, number> = { g: 0.001, kg: 1, ml: 0.001, l: 1, L: 1 };

function estimateCost(item: ShoppingListItem, product: MercadonaProduct): { cost: number, basis: string } {
  const pi = product.price_instructions;
  const unitKg = WEIGHT_UNITS[item.unidad];
  if (unitKg !== undefined && pi.reference_price) {
    const neededInRefUnit = item.cantidad * unitKg;
    const refPrice = Number.parseFloat(pi.reference_price);
    return { cost: Math.round(neededInRefUnit * refPrice * 100) / 100, basis: `${pi.reference_price} EUR/${pi.reference_format}` };
  }
  // Non-weight unit (unidades, dientes, rebanadas): no reliable conversion —
  // approximate with one unit of the matched product's own package price.
  const unitPrice = Number.parseFloat(pi.unit_price);
  return { cost: unitPrice, basis: `1x envase (${pi.unit_size ?? '?'} ${pi.reference_format}), sin conversion de unidad` };
}

async function main() {
  console.log('Descargando catalogo Mercadona (cache local en cache/)...');
  const catalog = await loadCatalog();
  console.log(`Catalogo cargado: ${catalog.length} productos`);

  const fixturePath = `${DIR}/../fresco-345-grocery-deeplink/fixture-shopping-list.json`;
  const aisles = JSON.parse(await readFile(fixturePath, 'utf8'));
  const items: ShoppingListItem[] = aisles.flatMap((a: { items: ShoppingListItem[] }) => a.items);

  let matched = 0;
  let totalMercadona = 0;
  let totalOriginal = 0;
  const rows: string[] = [
    '| Item | Cantidad | Match Mercadona | Precio original (est.) | Precio Mercadona | Base |',
    '|---|---|---|---|---|---|',
  ];

  for (const item of items) {
    totalOriginal += item.precio_estimado;
    const match = findBestMatch(item.nombre, catalog);
    if (!match) {
      rows.push(`| ${item.nombre} | ${item.cantidad} ${item.unidad} | **sin match** | ${item.precio_estimado.toFixed(2)} EUR | - | - |`);
      continue;
    }
    matched++;
    const { cost, basis } = estimateCost(item, match);
    totalMercadona += cost;
    rows.push(
      `| ${item.nombre} | ${item.cantidad} ${item.unidad} | ${match.display_name} | ${item.precio_estimado.toFixed(2)} EUR | ${cost.toFixed(2)} EUR | ${basis} |`,
    );
  }

  const scorecard = [
    '# FRESCO-488 spike: matching contra catalogo Mercadona (datania/mercadona-catalog)',
    '',
    `Lista real de Fresco (Laura, 6 pasillos, ${items.length} items) — misma fixture del spike original de FRESCO-345 (2026-09-10).`,
    '',
    `**Match rate: ${matched}/${items.length} (${Math.round((matched / items.length) * 100)}%)**`,
    '',
    `Coste estimado original (Fresco, precios medios genericos): **${totalOriginal.toFixed(2)} EUR**`,
    `Coste estimado Mercadona (catalogo real, items con match): **${totalMercadona.toFixed(2)} EUR**`,
    '',
    ...rows,
  ].join('\n');

  await writeFile(`${DIR}/out.scorecard.md`, scorecard);
  await writeFile(`${DIR}/out.scorecard.json`, JSON.stringify({ matched, total: items.length, totalOriginal, totalMercadona }, null, 2));
  console.log(scorecard);
}

void main();
