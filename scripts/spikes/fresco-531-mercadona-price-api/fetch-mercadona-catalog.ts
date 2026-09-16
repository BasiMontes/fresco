#!/usr/bin/env bun

// FRESCO-531 spike — Mercadona public catalog/price API feasibility
//
// Throwaway reference prototype. NOT wired into the app. Read-only: only hits
// GET endpoints, never touches the cart-write API (`POST /api/carts/`), which
// ADR-0027 correctly documented as blocked. Findings + recommendation: see
// README.md and ADR-0028.
//
// Usage:
//   bun scripts/spikes/fresco-531-mercadona-price-api/fetch-mercadona-catalog.ts
//
// Writes out.*.json (gitignored): the category tree sample, the rate-limit
// probe log, and a flattened product/price sample.

const BASE = 'https://tienda.mercadona.es/api';

interface PriceInstructions {
  unit_price: string
  bulk_price: string
  reference_price: string
  reference_format: string
  size_format: string
}

interface Product {
  id: string
  display_name: string
  packaging: string
  price_instructions: PriceInstructions
}

interface Subcategory {
  id: number
  name: string
  products?: Product[]
}

interface CategoryDetail {
  id: number
  name: string
  categories: Subcategory[]
}

interface TopCategory {
  id: number
  name: string
  categories: { id: number, name: string }[]
}

interface RateLimitProbeRow {
  categoryId: number
  httpStatus: number
  ms: number
  bytes: number
}

async function fetchTopCategories(): Promise<TopCategory[]> {
  const res = await fetch(`${BASE}/categories/`);
  const body = (await res.json()) as { results: TopCategory[] };
  return body.results;
}

async function fetchCategoryDetail(categoryId: number): Promise<CategoryDetail> {
  const res = await fetch(`${BASE}/categories/${categoryId}/`);
  return (await res.json()) as CategoryDetail;
}

// Rate-limit probe: N sequential requests, fixed delay between them, log
// status/timing/size. No 429/403 across this run means the read endpoint is
// not rate-limited at this volume — it does NOT mean it never will be (Akamai
// Bot Manager cookies are present on every response, see README "Risk").
async function probeRateLimit(categoryIds: number[], delayMs: number): Promise<RateLimitProbeRow[]> {
  const rows: RateLimitProbeRow[] = [];
  for (const categoryId of categoryIds) {
    const t0 = performance.now();
    const res = await fetch(`${BASE}/categories/${categoryId}/`);
    const text = await res.text();
    const ms = Math.round(performance.now() - t0);
    rows.push({ categoryId, httpStatus: res.status, ms, bytes: text.length });
    if (delayMs > 0) { await Bun.sleep(delayMs); }
  }
  return rows;
}

function flattenProducts(detail: CategoryDetail): Array<{
  subcategory: string
  id: string
  name: string
  packaging: string
  unit_price: string
  reference_price: string
  reference_format: string
}> {
  return detail.categories.flatMap(sub =>
    (sub.products ?? []).map(p => ({
      subcategory: sub.name,
      id: p.id,
      name: p.display_name,
      packaging: p.packaging,
      unit_price: p.price_instructions.unit_price,
      reference_price: p.price_instructions.reference_price,
      reference_format: p.price_instructions.reference_format,
    })),
  );
}

async function main(): Promise<void> {
  const outDir = new URL('./', import.meta.url);

  console.log('=== FRESCO-531 spike — Mercadona catalog/price API ===\n');

  console.log('1. Fetching top-level category tree...');
  const topCategories = await fetchTopCategories();
  console.log(`   ${topCategories.length} top-level categories`);
  await Bun.write(new URL('out.categories.json', outDir), JSON.stringify(topCategories, null, 2));

  console.log('\n2. Fetching one subcategory in full detail (products + price_instructions inline)...');
  const sampleCategoryId = topCategories[0].categories[0].id;
  const detail = await fetchCategoryDetail(sampleCategoryId);
  const products = flattenProducts(detail);
  console.log(`   category "${detail.name}" -> ${products.length} products, price included, zero extra requests`);
  await Bun.write(new URL('out.products-sample.json', outDir), JSON.stringify(products, null, 2));

  console.log('\n3. Rate-limit probe: 10 sequential category fetches, 0ms delay...');
  const sampleIds = topCategories.slice(0, 10).flatMap(c => c.categories[0]?.id ?? []);
  const probeRows = await probeRateLimit(sampleIds, 0);
  await Bun.write(new URL('out.rate-limit-probe.json', outDir), JSON.stringify(probeRows, null, 2));

  const blocked = probeRows.filter(r => r.httpStatus === 429 || r.httpStatus === 403);
  const avgMs = Math.round(probeRows.reduce((sum, r) => sum + r.ms, 0) / probeRows.length);

  console.log('\n--- scorecard ---');
  console.log(`  requests sent ............ ${probeRows.length}`);
  console.log(`  429/403 responses ........ ${blocked.length}`);
  console.log(`  avg response time ........ ${avgMs}ms`);
  console.log(`  sample product w/ price ... ${products[0]?.name} -> ${products[0]?.unit_price} EUR (${products[0]?.reference_price}/${products[0]?.reference_format})`);
  console.log('\n  exports written: out.categories.json, out.products-sample.json, out.rate-limit-probe.json\n');
}

await main();
