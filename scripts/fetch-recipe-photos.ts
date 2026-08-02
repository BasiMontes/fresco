#!/usr/bin/env bun

// FRESCO-31 — recipe photo backfill via Unsplash's free tier (50 req/hour).
// Usage: bun scripts/fetch-recipe-photos.ts [batchSize=30] > /tmp/batch.json
// Prints a JSON array of `{id, foto_url}` to stdout (progress goes to
// stderr). Convert to SQL and apply:
//   jq -r '.[] | "update public.recipes set foto_url = " + (.foto_url|@sh) + " where id = " + (.id|@sh) + ";"' /tmp/batch.json > /tmp/batch.sql
// then run `/tmp/batch.sql` via the Supabase SQL editor/MCP. Verify zero
// duplicates afterward: `select foto_url, count(*) from recipes where
// foto_url is not null group by foto_url having count(*) > 1`.
//
// Fetches one Unsplash photo per recipe. v5 — single attempt per recipe,
// query = `${nombre} cooked meal food photography`. NOT collection-scoped
// (tried and reverted, see below).
//
// STATUS AS OF 2026-08-02 (afternoon session): collection-scoping to
// Unsplash's official "Food & Drink" collection (id 3330455) was
// implemented and finally validated live this session — and it made things
// WORSE, not better. Real batch of 11: only 2/11 got any result at all
// (2.5k images is too small a pool for 1000 distinct combinatorial Spanish
// dish names — most searches just came back empty), and both of the 2
// hits that DID return were still wrong dishes (a sandwich for "Porridge
// de avena con manzana y canela", a burger for "Congrí cubano con huevo
// frito") — being inside a real-food-photography collection does not mean
// the SPECIFIC dish is in it. Reverted the `collections=` param entirely.
// Don't re-add it without a much bigger collection or a different curation
// strategy — this exact one was tested and failed both on coverage and
// accuracy.
//
// The "cooked meal food photography" query suffix (no collection scope)
// remains — that part DID measurably help in earlier live checks (e.g.
// "Arroz con magro y pimientos" went from a raw-pepper market photo to a
// real rice bowl with meat).
//
// History: v1 searched by `categoria` (bucket-level, caused literal
// duplicate photos across unrelated recipes in the same category). v2
// added a base-dish translation table (unnecessary complexity, dropped).
// v3 searched `nombre` directly with a 3-deep fallback cascade
// (nombre -> descripcion_corta -> categoria) — dropped because it tripped
// the burst limiter 3x as often for no real quality gain. v4 added the
// "cooked meal food photography" bias AND collection-scoping together,
// untested. v5 (this version) keeps the query bias, drops the collection
// scope after live-validating it hurt more than it helped.
//
// Known unsolved problem, not fixed by any version so far: recipes whose
// top-K Unsplash results happen to overlap land on the literal same photo
// (hash-of-id modulo collision) — found again this session across 5 groups
// / 11 recipes in the 67 already applied, including one photo shared by 3
// completely different dishes. No fix attempted yet; would need either a
// global "photo already used" exclusion list across the whole run, or
// giving up on the hash-for-variety approach in favor of always picking
// index 0 (best-relevance, but back to the literal-duplicate risk this was
// designed to avoid in the first place — the real tension is unresolved).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const UNSPLASH_KEY = process.env.UNPLASH_ACCESS_KEY!;
const BATCH_SIZE = Number(process.argv[2] ?? 30);

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036F]/g, '');
}

interface RecipeRow {
  id: string
  nombre: string
  descripcion_corta: string
  clasificacion: { categoria: string }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Unsplash's `urls.regular` carries a per-request `ixid` tracking param that
 * encodes the search query/timestamp — the SAME underlying photo returned
 * for two different queries produces two DIFFERENT full URLs. Comparing
 * `usedUrls` by the full string never catches a real duplicate (confirmed
 * live this session: two recipes both landed on photo-1543826173-... with
 * visibly different query strings, exact-string dedup missed it entirely).
 * This extracts the stable `photo-<id>` path segment to compare by.
 */
function photoId(url: string): string {
  return url.match(/\/(photo-[^?]+)/)?.[1] ?? url;
}

async function searchUnsplash(query: string, seed: string, usedUrls: Set<string>): Promise<string | null> {
  // Unsplash has a short burst limiter distinct from the 50/hour quota —
  // firing requests back-to-back (as this script does across the
  // nombre -> descripcion_corta -> categoria fallback chain) trips it even
  // with hourly quota to spare (confirmed live: 403 "Rate Limit Exceeded"
  // while X-Ratelimit-Remaining still showed plenty left; recovered within
  // 5s of pausing).
  await sleep(1200);
  const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=squarish`, {
    headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
  });
  if (!res.ok) {
    console.error(`Unsplash error ${res.status} for query "${query}"`);
    if (res.status === 403) {
      // Burst limiter, not the hourly quota — 400ms wasn't enough to clear
      // it reliably across a real batch (confirmed live: still cascaded on
      // most requests). Cool down harder before the next attempt.
      await sleep(4000);
    }
    return null;
  }
  const body = await res.json() as { results: { urls: { regular: string } }[] };
  if (body.results.length === 0) { return null; }

  // Pick from Unsplash's top 4 (most-relevant) results first, not all 10 —
  // a live full review of 70 applied photos found the worst mismatches
  // (a wedding program for "Espaguetis a la boloñesa", raw ingredients for
  // several soups/salads) came from indices 5-9, where relevance craters.
  // Hashed (not always index 0) so recipes with an overlapping top-4 don't
  // reach for the identical first choice — BUT the hash alone isn't enough:
  // two recipes with near-identical result sets and the same hash%topK
  // land on the literal same photo every time, deterministically, no
  // matter how many times you retry (confirmed live this session — 2
  // pairs collided again on a re-run after a reset, byte-identical URLs).
  // `usedUrls` (shared across the whole batch by the caller) is what
  // actually breaks the tie: the first recipe to reach a given photo
  // claims it, the next one falls through to its next-preferred index,
  // and only past that to the "worse" indices 4-9 as a last resort before
  // giving up rather than forcing a duplicate.
  const topK = Math.min(4, body.results.length);
  let hash = 0;
  for (let i = 0; i < seed.length; i++) { hash = (hash * 31 + seed.charCodeAt(i)) >>> 0; }
  const preferredStart = hash % topK;

  const order: number[] = [];
  for (let i = 0; i < topK; i++) { order.push((preferredStart + i) % topK); }
  for (let i = topK; i < body.results.length; i++) { order.push(i); }

  for (const idx of order) {
    const url = body.results[idx]?.urls.regular;
    if (url && !usedUrls.has(photoId(url))) {
      usedUrls.add(photoId(url));
      return url;
    }
  }
  return null;
}

async function main() {
  // Seed with every foto_url already applied — a fresh fetch must never
  // collide with an existing GOOD photo either, not just with others in
  // this same batch (the hash-collision bug found live this session isn't
  // scoped to one run).
  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/recipes?select=foto_url&foto_url=not.is.null`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
  );
  const existing = await existingRes.json() as { foto_url: string }[];
  const usedUrls = new Set(existing.map(r => photoId(r.foto_url)));
  console.error(`Seeded ${usedUrls.size} already-applied photo URLs as excluded.`);

  const listRes = await fetch(
    `${SUPABASE_URL}/rest/v1/recipes?select=id,nombre,descripcion_corta,clasificacion&foto_url=is.null&limit=${BATCH_SIZE}`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
  );
  const recipes = await listRes.json() as RecipeRow[];
  console.error(`Fetching photos for ${recipes.length} recipes (batch size ${BATCH_SIZE})...`);

  // Single attempt per recipe, no cascade — the nombre -> descripcion_corta
  // -> categoria fallback chain was tripping Unsplash's burst limiter by
  // firing up to 3 requests per recipe; one request per recipe is the real
  // fix, not a longer delay on top of the same 3x volume.
  const results: { id: string, foto_url: string }[] = [];
  for (const recipe of recipes) {
    // "cooked meal food photography" bias: raw nombre alone too often
    // matches a raw-ingredient or product-photography stock shot (confirmed
    // live — "Arroz con magro y pimientos" returned a market bin of raw
    // peppers, zero rice, zero meat; "Sopa de tomate y albahaca" returned a
    // single raw tomato). Unsplash's tags/alt-text skew English, so an
    // explicit "cooked" disambiguator pushes results toward actual
    // prepared-meal photography instead of ingredient close-ups.
    const query = `${stripAccents(recipe.nombre)} cooked meal food photography`;
    const url = await searchUnsplash(query, recipe.id, usedUrls);

    if (url) {
      results.push({ id: recipe.id, foto_url: url });
      console.error(`OK  [${query}] ${recipe.nombre}`);
    }
    else {
      console.error(`No photo found for ${recipe.nombre} (skipped, no cascade)`);
    }
  }
  console.error(`Fetched ${results.length}/${recipes.length}. Writing JSON to stdout for SQL application.`);
  console.log(JSON.stringify(results));
}

void main();
