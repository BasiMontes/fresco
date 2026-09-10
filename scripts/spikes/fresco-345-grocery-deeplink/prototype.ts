#!/usr/bin/env bun

// FRESCO-345 spike — grocery-integration feasibility (deep-link + export)
//
// Throwaway reference prototype. NOT wired into the app. The story is BLOCKED
// by `mvp-scope.md` (Out-of-Scope Blacklist) until MRR > 5.000 EUR AND 30-day
// retention > 50%. This exists so the build/no-build decision is already made
// when the block lifts. Findings + recommendation: see README.md and the
// FRESCO-345 refinement comment.
//
// Usage:
//   bun scripts/spikes/fresco-345-grocery-deeplink/prototype.ts
//
// Runs against `fixture-shopping-list.json` — a real Fresco list snapshot
// (prod `shopping_lists/962a1b65-c9b0-4db3-bdd3-1966f8790b7c`, Laura's weekly
// plan, 6 pasillos / 23 items). To re-run against a fresh list:
//   supabase db query --linked \
//     "select items as pasillos from shopping_lists where id = '<id>';" \
//     | jq '.rows[0].pasillos' > fixture-shopping-list.json

interface Uso {
  dia: string
  receta: string
}

interface Item {
  nombre: string
  cantidad: number
  unidad: string
  comprado: boolean
  precio_estimado: number
  usos: Uso[]
}

interface Pasillo {
  nombre: string
  orden: number
  items: Item[]
}

interface DeepLinkRow {
  nombre: string
  cantidad: string
  term: string
  lossy: boolean
  unitGap: boolean
  carrefour: string
  dia: string
}

// Copy of `lib/text/normalize-nombre.ts` — kept local so the spike has zero
// imports into app code.
function normalizeNombre(nombre: string): string {
  return nombre
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[áàä]/g, 'a')
    .replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u')
    .replace(/ñ/g, 'n');
}

// Deep-link builders. Verify the query param in a real browser before shipping
// anything — findings (2026-09-10):
//   - Dia: `search?q=` confirmed working (anonymous; price/stock need a postal
//     code). Its search engine is weak: short terms fuzzy-match to garbage
//     ("tofu" -> only "toffee" products), niche terms return nothing
//     ("levadura nutricional" -> 0 results).
//   - Carrefour: `?q=` is ignored (loads the homepage); `search-page?q=`
//     returns HTTP 403 to non-browser clients. No stable public contract.
const RETAILERS = {
  carrefour: {
    label: 'Carrefour',
    search: (term: string): string =>
      `https://www.carrefour.es/search-page?q=${encodeURIComponent(term)}`,
  },
  dia: {
    label: 'Dia',
    search: (term: string): string =>
      `https://www.dia.es/search?q=${encodeURIComponent(term)}`,
  },
} as const;

// Fresco stores recipe-ingredient names. A few carry recipe context that a
// supermarket search chokes on, or are too generic to land a good result.
// Minimal hand map — a real build needs a proper ingredient->product layer.
const TERM_OVERRIDES: Record<string, string> = {
  'levadura nutricional': 'levadura nutricional copos',
  'aceite de oliva': 'aceite de oliva virgen extra',
  'pan': 'pan de molde',
  'queso fresco': 'queso fresco batido',
};

// Items whose Fresco name drops information the shopper needs at the shelf
// (e.g. the recipe said "salmón ahumado", the list stores "salmón").
const LOSSY_NAMES = new Set(['salmon', 'queso', 'pan']);

// Fresco units that are not retail units — the shopper has to eyeball pack
// size because a deep link cannot carry "you need 500 ml".
const RETAIL_UNITS = new Set(['unidad', 'unidades', 'ud']);

function toSearchTerm(nombre: string): string {
  return TERM_OVERRIDES[normalizeNombre(nombre)] ?? nombre;
}

function hasUnitGap(item: Item): boolean {
  return !RETAIL_UNITS.has(normalizeNombre(item.unidad));
}

function buildRows(items: Item[]): DeepLinkRow[] {
  return items.map((it) => {
    const term = toSearchTerm(it.nombre);
    return {
      nombre: it.nombre,
      cantidad: `${it.cantidad} ${it.unidad}`,
      term,
      lossy: LOSSY_NAMES.has(normalizeNombre(it.nombre)),
      unitGap: hasUnitGap(it),
      carrefour: RETAILERS.carrefour.search(term),
      dia: RETAILERS.dia.search(term),
    };
  });
}

function toPlainText(items: Item[]): string {
  return items.map(it => `${it.cantidad} ${it.unidad} ${it.nombre}`).join('\n');
}

function toCsv(items: Item[]): string {
  const header = 'cantidad,unidad,nombre,precio_estimado';
  const body = items
    .map(it => `${it.cantidad},${it.unidad},"${it.nombre}",${it.precio_estimado}`)
    .join('\n');
  return `${header}\n${body}`;
}

function toMarkdown(pasillos: Pasillo[]): string {
  return pasillos
    .map((p) => {
      const lines = p.items
        .map(it => `- [ ] ${it.cantidad} ${it.unidad} — ${it.nombre}`)
        .join('\n');
      return `### ${p.nombre}\n${lines}`;
    })
    .join('\n\n');
}

async function main(): Promise<void> {
  const fixturePath = new URL('./fixture-shopping-list.json', import.meta.url);
  const pasillos = (await Bun.file(fixturePath).json()) as Pasillo[];
  const items = pasillos.flatMap(p => p.items);
  const rows = buildRows(items);

  const outDir = new URL('./', import.meta.url);
  await Bun.write(new URL('out.lista.txt', outDir), toPlainText(items));
  await Bun.write(new URL('out.lista.csv', outDir), toCsv(items));
  await Bun.write(new URL('out.lista.md', outDir), toMarkdown(pasillos));
  await Bun.write(new URL('out.deeplinks.json', outDir), JSON.stringify(rows, null, 2));

  const total = rows.length;
  const lossyN = rows.filter(r => r.lossy).length;
  const gapN = rows.filter(r => r.unitGap).length;
  const plainLen = toPlainText(items).length;

  console.log(`\n=== FRESCO-345 spike — ${pasillos.length} pasillos / ${total} items ===\n`);
  console.log('item                 | cantidad      | search term                  | flags');
  console.log('-'.repeat(92));
  for (const r of rows) {
    const flags = [r.lossy ? 'LOSSY-NAME' : '', r.unitGap ? 'UNIT-GAP' : '']
      .filter(Boolean)
      .join(' ');
    console.log(
      `${r.nombre.padEnd(20)} | ${r.cantidad.padEnd(13)} | ${r.term.padEnd(28)} | ${flags}`,
    );
  }

  console.log('\n--- sample deep links ---');
  for (const r of rows.slice(0, 4)) {
    console.log(`  ${r.nombre}`);
    console.log(`    Dia:       ${r.dia}`);
    console.log(`    Carrefour: ${r.carrefour}`);
  }

  const pct = (n: number): number => Math.round((n / total) * 100);
  console.log('\n--- scorecard ---');
  console.log(`  items total .............. ${total}`);
  console.log(`  clean name -> searchable . ${total - lossyN} (${pct(total - lossyN)}%)`);
  console.log(`  lossy name (recipe ctx) .. ${lossyN}  -> wrong-variant risk at the shelf`);
  console.log(`  unit-reconciliation gap .. ${gapN} (${pct(gapN)}%)  -> deep link cannot carry "how much"`);
  console.log(`  taps to fill a cart ...... ${total} searches + ${total}+ add-to-cart per retailer`);
  console.log(`  plaintext export ......... ${plainLen} chars (fits any clipboard)`);
  console.log('\n  exports written: out.lista.{txt,csv,md} , out.deeplinks.json\n');
}

await main();
