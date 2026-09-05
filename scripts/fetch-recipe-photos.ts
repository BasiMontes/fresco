#!/usr/bin/env bun

// FRESCO-31 — recipe photo backfill via Unsplash (50 req/hour), falling back
// to Pexels (200 req/hour) and Pixabay (5000 req/hour) free tiers when
// Unsplash has nothing for a given dish. See the v12 note further down.
// Usage: bun scripts/fetch-recipe-photos.ts [batchSize=30] > /tmp/batch.json
// Prints a JSON array of `{id, foto_url}` to stdout (progress goes to
// stderr). Convert to SQL and apply:
//   jq -r '.[] | "update public.recipes set foto_url = " + (.foto_url|@sh) + " where id = " + (.id|@sh) + ";"' /tmp/batch.json > /tmp/batch.sql
// then run `/tmp/batch.sql` via the Supabase SQL editor/MCP. Verify zero
// duplicates afterward: `select foto_url, count(*) from recipes where
// foto_url is not null group by foto_url having count(*) > 1`.
//
// Fetches one Unsplash photo per recipe. v6 — translates the query,
// doesn't just accent-strip it. Root cause found live this session: v5 sent
// the raw SPANISH recipe name to Unsplash, an English-tagged stock-photo
// database — a real miss ("Champiñones al ajillo con perejil picante con
// jengibre" returned a poke bowl with a Jarritos soda bottle and a cactus
// in frame; nothing about the query semantically matched "garlic
// mushrooms"). No paid translation API (explicit user constraint, zero
// added cost) — instead: (1) strip the generic filler modifiers this
// dataset's combinatorial name-generator adds (`al estilo mediterráneo`,
// `versión ligera`, `con guarnición de temporada`, etc.) that carry zero
// photographic signal and only dilute the query, then (2) translate the
// remaining real content words via a static ES->EN dictionary built from
// this table's actual vocabulary (proteins, techniques, bases, visually-
// meaningful seasonings). Unrecognized words pass through untranslated
// rather than being dropped — degrades gracefully instead of losing
// content. `topK` also dropped 4 -> 2 (see below) — user's own framing:
// "fewer but better", trust top-relevance more now that queries are
// actually in the right language.
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
//
// v9 — root-caused the hit-rate collapse at 735/1000 applied (was 7-11/30,
// dropped to 1-3/30). NOT a translation/relevance problem: this table's
// combinatorial name-generator produces dozens of distinct recipes that
// all collapse to the SAME translated query once FILLER_PHRASES strips the
// modifier ("Salmon al horno con hierbas frescas version ligera" / "...al
// estilo del sur con guarnicion de temporada" / "...estilo casero version
// ligera" all reduce to "salmon baked cooked meal food photography" —
// confirmed by sampling 15 random still-unphotographed rows live, every
// one was a filler-only variant of an already-saturated concept). With
// per_page capped at 30 and hundreds of recipes funneling into a few dozen
// concept-buckets (baked salmon, chickpea salad, grilled squid...), those
// buckets exhaust their entire page-1 candidate pool against `usedUrls`
// well before the recipe pool does — every later recipe in that bucket
// gets "no unclaimed candidate", indistinguishable in the old code from
// "Unsplash genuinely has nothing for this". Fix: `searchUnsplash` now
// tries page 2 (results 31-60) ONLY when page 1 returned candidates but
// all were already claimed — a real page-2 fetch, not a relevance
// downgrade, since Unsplash's own ranking for a common concept like
// "salmon baked" stays legitimately on-topic 30-60 results deep (unlike
// the old per_page=10/index 5-9 finding, which was a different, much
// shallower pool). Costs a second HTTP call only in the exhaustion case
// (rare early in a run, common now), so the burst-limiter cooldown logic
// applies to both requests equally.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const UNSPLASH_KEY = process.env.UNPLASH_ACCESS_KEY!;
// v12 — FRESCO-31: Unsplash's own corpus for this table's combinatorial
// dish names hit a wall this session (86 candidates fetched, 1 usable —
// content_filter=high + a healthy hit-rate, but the SPECIFIC dish just
// isn't in Unsplash's collection). Pexels (200 req/hour, 20k/month) and
// Pixabay (5000 req/hour) are additional free-tier stock-photo corpora with
// their own independent collections — same translated-query strategy, tried
// only after both Unsplash tiers come back empty, so they add coverage
// without diluting Unsplash's already-tuned precision.
const PEXELS_KEY = process.env.PEXELS_API_KEY!;
const PIXABAY_KEY = process.env.PIXABAY_API_KEY!;
const BATCH_SIZE = Number(process.argv[2] ?? 30);

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036F]/g, '');
}

// Generic modifiers this table's combinatorial name-generator adds to
// nearly every recipe \u2014 none of them describe anything a camera can see,
// they only pad the query with words Unsplash has to (fail to) match
// against. Matched against the accent-stripped, lowercased name.
const FILLER_PHRASES: RegExp[] = [
  /\bal estilo (mediterraneo|del sur)\b/g,
  /\bestilo casero\b/g,
  /\bversion ligera\b/g,
  /\bcon guarnicion de temporada\b/g,
  /\bcon verduras de temporada\b/g,
  /\bcon especias\b/g,
  /\bcon hierbas frescas\b/g,
];

// Static Spanish->English dictionary, built from this table's real
// vocabulary (sampled live via SQL, not guessed) \u2014 proteins, cooking
// techniques, bases, and the seasonings/garnishes that actually carry
// visual signal. Keys are accent-stripped + lowercased to match
// `stripAccents(...).toLowerCase()` output. No paid translation API by
// explicit user constraint (zero added cost); words missing from this map
// pass through unmodified rather than being dropped.
const ES_EN_WORDS: Record<string, string> = {
  // proteins
  'pollo': 'chicken',
  'cerdo': 'pork',
  'ternera': 'beef',
  'pavo': 'turkey',
  'salmon': 'salmon',
  'gambas': 'shrimp',
  'merluza': 'hake',
  'dorada': 'sea bream',
  'atun': 'tuna',
  'mejillones': 'mussels',
  'calamares': 'squid',
  'huevos': 'eggs',
  'huevo': 'egg',
  'conejo': 'rabbit',
  'solomillo': 'tenderloin',
  'lomo': 'pork loin',
  'jamon': 'ham',
  'panceta': 'bacon',
  'costillas': 'ribs',
  'tofu': 'tofu',
  'tempeh': 'tempeh',
  'seitan': 'seitan',
  'higado': 'liver',
  // techniques
  'horno': 'baked',
  'plancha': 'grilled',
  'salteado': 'sauteed',
  'salteada': 'sauteed',
  'salteados': 'sauteed',
  'salteadas': 'sauteed',
  'guisado': 'stewed',
  'guisada': 'stewed',
  'asada': 'roasted',
  'asado': 'roasted',
  'asadas': 'roasted',
  'asados': 'roasted',
  'revueltos': 'scrambled',
  'poche': 'poached',
  'vapor': 'steamed',
  'estofadas': 'braised',
  'estofado': 'braised',
  'frito': 'fried',
  'frita': 'fried',
  'ahumado': 'smoked',
  // bases
  'arroz': 'rice',
  'pasta': 'pasta',
  'lentejas': 'lentils',
  'garbanzos': 'chickpeas',
  'alubias': 'beans',
  'quinoa': 'quinoa',
  'patatas': 'potatoes',
  'avena': 'oats',
  // dish types
  'ensalada': 'salad',
  'sopa': 'soup',
  'crema': 'creamy soup',
  'tortilla': 'omelette',
  'tostada': 'toast',
  'bowl': 'bowl',
  'batido': 'smoothie',
  'yogur': 'yogurt',
  'gofres': 'waffles',
  'muesli': 'muesli',
  'porridge': 'oatmeal',
  'wrap': 'wrap',
  'sandwich': 'sandwich',
  'hamburguesa': 'burger',
  'bagel': 'bagel',
  'risotto': 'risotto',
  'lasana': 'lasagna',
  'curry': 'curry',
  'griego': 'greek',
  // vegetables / extras
  'champinones': 'mushrooms',
  'setas': 'mushrooms',
  'espinacas': 'spinach',
  'calabaza': 'pumpkin',
  'berenjena': 'eggplant',
  'berenjenas': 'eggplant',
  'tomate': 'tomato',
  'aguacate': 'avocado',
  'queso': 'cheese',
  'cebolla': 'onion',
  'coliflor': 'cauliflower',
  'repollo': 'cabbage',
  'coles': 'brussels',
  'bruselas': 'sprouts',
  'chia': 'chia seeds',
  'verduras': 'vegetables',
  'granola': 'granola',
  // seasonings/garnishes with real visual signal
  'miel': 'honey',
  'canela': 'cinnamon',
  'limon': 'lemon',
  'lima': 'lime',
  'jengibre': 'ginger',
  'ajo': 'garlic',
  'ajillo': 'garlic',
  'perejil': 'parsley',
  'cilantro': 'cilantro',
  'albahaca': 'basil',
  'tamari': 'tamari',
  'sesamo': 'sesame',
  'curcuma': 'turmeric',
  'comino': 'cumin',
  'aceitunas': 'olives',
  'frutos rojos': 'berries',
  'nueces': 'walnuts',
  'semillas': 'seeds',
  'lino': 'flax',
  'girasol': 'sunflower',
  'picante': 'spicy',
  'griega': 'greek',
  'bacalao': 'cod',
  'cordero': 'lamb',
  'tortitas': 'pancakes',
  'rellena': 'stuffed',
  'rellenas': 'stuffed',
  'relleno': 'stuffed',
  'rellenos': 'stuffed',
  'leche': 'milk',
  'fria': 'cold',
  'frio': 'cold',
};

const STOPWORDS = new Set(['con', 'y', 'de', 'a', 'la', 'el', 'del', 'las', 'los', 'al']);

function translateQuery(nombre: string): string {
  let text = stripAccents(nombre.toLowerCase());
  for (const pattern of FILLER_PHRASES) { text = text.replace(pattern, ' '); }

  const words = text.split(/\s+/).filter(Boolean).filter(w => !STOPWORDS.has(w));
  const translated = words.map(w => ES_EN_WORDS[w] ?? w);
  return [...new Set(translated)].join(' ');
}

// v10 — broad-query fallback tier, only fired when the precise query is
// fully exhausted (searchUnsplash returned null after trying page 1 + page
// 2 where applicable). At 736/1000 applied, the precise query's hit rate
// dropped to ~1/30 — most remaining recipes are filler-only variants of an
// already-saturated concept-bucket (see v9 note), and pagination alone
// can't fix a bucket whose TOTAL corpus is already claimed. User's own
// call: since a later polish pass will manually fix any photo that
// doesn't match reality, precision matters less than coverage right now —
// trade some specificity for a much bigger candidate pool. Keeps only the
// first 2 translated content words (dish-type/base + primary protein or
// main ingredient, in source order — the words FILLER_PHRASES/STOPWORDS
// leave closest to the front of the name) and drops the "cooked meal"
// bias entirely, since that bias is exactly the kind of extra specificity
// that shrinks the corpus for a bucket that's already running dry.
function broadenQuery(nombre: string): string {
  const words = translateQuery(nombre).split(' ').filter(Boolean);
  return words.slice(0, 2).join(' ');
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

async function fetchUnsplashPage(query: string, page: number): Promise<{ urls: { regular: string } }[] | null> {
  // Unsplash has a short burst limiter distinct from the 50/hour quota —
  // firing requests back-to-back (as this script does across the
  // nombre -> descripcion_corta -> categoria fallback chain) trips it even
  // with hourly quota to spare (confirmed live: 403 "Rate Limit Exceeded"
  // while X-Ratelimit-Remaining still showed plenty left; recovered within
  // 5s of pausing).
  await sleep(1200);
  // v11: content_filter=high — FRESCO-192's audit found one applied photo
  // (17ef7f11) with a real person + visible text that had to be nulled as
  // inappropriate. Unsplash's own moderation filter costs nothing and
  // rules that class of result out before it ever reaches pickFromPage.
  const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=30&page=${page}&orientation=squarish&content_filter=high`, {
    headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
  });
  if (!res.ok) {
    console.error(`Unsplash error ${res.status} for query "${query}" (page ${page})`);
    if (res.status === 403) {
      // Burst limiter, not the hourly quota — 400ms wasn't enough to clear
      // it reliably across a real batch (confirmed live: still cascaded on
      // most requests). Cool down harder before the next attempt.
      await sleep(4000);
    }
    return null;
  }
  const body = await res.json() as { results: { urls: { regular: string } }[] };
  return body.results;
}

// Picks the seed-hashed top-2 first, then falls through the rest of a
// single page's results, in the order described at the v6 note above (file
// header). Returns null if every candidate in this page is already used.
function pickFromPage(results: { urls: { regular: string } }[], seed: string, usedUrls: Set<string>): string | null {
  if (results.length === 0) { return null; }

  // Pick from Unsplash's top 2 (most-relevant) results first, not all 30 —
  // a live full review of 70 applied photos found the worst mismatches
  // (a wedding program for "Espaguetis a la boloñesa", raw ingredients for
  // several soups/salads) came from indices 5-9, where relevance craters.
  // v6: narrowed 4 -> 2 (was reaching into index 2-3 too often, e.g. the
  // Jarritos-bottle/cactus mismatch) — trust top-relevance more now that
  // the query is actually translated (see file header), per the explicit
  // "fewer but better" direction. Hashed (not always index 0) so recipes
  // with an overlapping top-2 don't reach for the identical first choice —
  // BUT the hash alone isn't enough: two recipes with near-identical result
  // sets and the same hash%topK land on the literal same photo every time,
  // deterministically, no matter how many times you retry (confirmed live
  // this session — 2 pairs collided again on a re-run after a reset,
  // byte-identical URLs). `usedUrls` (shared across the whole batch by the
  // caller) is what actually breaks the tie: the first recipe to reach a
  // given photo claims it, the next one falls through to its
  // next-preferred index, and only past that to the "worse" indices 2-29 as
  // a last resort before giving up rather than forcing a duplicate.
  const topK = Math.min(2, results.length);
  let hash = 0;
  for (let i = 0; i < seed.length; i++) { hash = (hash * 31 + seed.charCodeAt(i)) >>> 0; }
  const preferredStart = hash % topK;

  const order: number[] = [];
  for (let i = 0; i < topK; i++) { order.push((preferredStart + i) % topK); }
  for (let i = topK; i < results.length; i++) { order.push(i); }

  for (const idx of order) {
    const url = results[idx]?.urls.regular;
    if (url && !usedUrls.has(photoId(url))) {
      usedUrls.add(photoId(url));
      return url;
    }
  }
  return null;
}

// v8 — per_page 10 -> 30. Root cause found live: with ~465 photos already
// applied, breakfast recipes (avena/huevos/yogur/tostadas/muesli) hit
// "no photo found" at a much higher rate than lunch/dinner ones — batch
// 17 was 27/30 breakfast failures, 0 rate-limit errors in the log. These
// are a narrow, closed set of visual concepts repeated across hundreds of
// combinatorial name variants, so with only 10 candidates per query the
// small set of real "scrambled eggs"/"oatmeal bowl"/etc. photos gets
// exhausted by `usedUrls` fast — not a translation or relevance problem,
// an exhaustion problem. 30 (Unsplash's per_page max) gives the fallback
// loop below 3x more candidates to find an unclaimed one before giving up.
//
// v9 — added a page-2 fallback. See the file-header v9 note: once a
// concept-bucket's ENTIRE page-1 pool is claimed (not just top-K), every
// later recipe in that bucket used to fail outright. Page 1 exhausted (had
// results, all claimed) -> try page 2 before giving up. Page 1 genuinely
// empty (Unsplash has nothing for this query at all) -> don't bother with
// page 2 either, same conclusion either page.
async function searchUnsplash(query: string, seed: string, usedUrls: Set<string>): Promise<string | null> {
  const page1 = await fetchUnsplashPage(query, 1);
  if (page1 === null || page1.length === 0) { return null; }

  const fromPage1 = pickFromPage(page1, seed, usedUrls);
  if (fromPage1) { return fromPage1; }

  // A page-1 result count under 30 (the per_page max) means Unsplash's
  // total corpus for this query is fully contained in page 1 — there is no
  // page 2 to fetch. Confirmed live: 8/10 exhausted queries in a v9 test
  // batch had page1.length < 30, and every one of those returned an empty
  // page 2 (wasted request, some even tripped the burst limiter). Only
  // firing page 2 when page 1 came back full targets the real case (a
  // large concept-bucket like "baked salmon" with 60+ total photos, where
  // the first 30 are claimed but 30 more genuinely exist) instead of
  // burning a guaranteed-empty request on small/niche queries.
  if (page1.length < 30) { return null; }

  const page2 = await fetchUnsplashPage(query, 2);
  if (page2 === null || page2.length === 0) { return null; }
  return pickFromPage(page2, seed, usedUrls);
}

// v12 — no `category=food` scoping: the file-header v4 note already
// live-validated that collection/category scoping on Unsplash made results
// WORSE (a 2.5k-image collection was too narrow for these combinatorial
// names, and being "inside a food collection" didn't mean the SPECIFIC dish
// was in it). Same risk applies to Pixabay's category filter — rely on the
// translated query alone, same as Unsplash.
async function fetchPexelsPage(query: string): Promise<{ urls: { regular: string } }[] | null> {
  // Pexels' free tier (200 req/hour) is generous relative to Unsplash's
  // 50/hour — a light throttle is still worth keeping since this script
  // fires requests back-to-back across the fallback chain.
  await sleep(300);
  const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=30&orientation=square`, {
    headers: { Authorization: PEXELS_KEY },
  });
  if (!res.ok) {
    console.error(`Pexels error ${res.status} for query "${query}"`);
    return null;
  }
  const body = await res.json() as { photos: { src: { large: string } }[] };
  return body.photos.map(p => ({ urls: { regular: p.src.large } }));
}

async function searchPexels(query: string, seed: string, usedUrls: Set<string>): Promise<string | null> {
  const results = await fetchPexelsPage(query);
  if (!results || results.length === 0) { return null; }
  return pickFromPage(results, seed, usedUrls);
}

async function fetchPixabayPage(query: string): Promise<{ urls: { regular: string } }[] | null> {
  // Pixabay's free tier is 5000 req/hour — the least quota-constrained of
  // the three, but still throttled lightly for the same back-to-back-calls
  // reason as Pexels above.
  await sleep(300);
  const res = await fetch(`https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(query)}&image_type=photo&per_page=30&safesearch=true`);
  if (!res.ok) {
    console.error(`Pixabay error ${res.status} for query "${query}"`);
    return null;
  }
  const body = await res.json() as { hits: { largeImageURL: string }[] };
  return body.hits.map(h => ({ urls: { regular: h.largeImageURL } }));
}

async function searchPixabay(query: string, seed: string, usedUrls: Set<string>): Promise<string | null> {
  const results = await fetchPixabayPage(query);
  if (!results || results.length === 0) { return null; }
  return pickFromPage(results, seed, usedUrls);
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

  // v7 — pull a much larger candidate pool (not just BATCH_SIZE) and shuffle
  // it before slicing. Found live across 4 straight batches this session:
  // the same ~15 recipes (chía, "Coles de Bruselas...", "Tortilla francesa
  // con canela", etc.) always land in the first BATCH_SIZE `foto_url is
  // null` rows in the same DB order, fail every single time (Unsplash has
  // nothing for that exact query), and get re-tried batch after batch —
  // burning real quota on the same dead rows instead of reaching new
  // recipes. Shuffling the pool client-side means a failing recipe competes
  // for a slot on equal terms with every other un-photographed recipe,
  // instead of monopolizing the front of the queue forever.
  const poolRes = await fetch(
    `${SUPABASE_URL}/rest/v1/recipes?select=id,nombre,descripcion_corta,clasificacion&foto_url=is.null&limit=${BATCH_SIZE * 10}`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
  );
  const pool = await poolRes.json() as RecipeRow[];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const recipes = pool.slice(0, BATCH_SIZE);
  console.error(`Fetching photos for ${recipes.length} recipes (batch size ${BATCH_SIZE}, shuffled from a pool of ${pool.length})...`);

  // v10 — two attempts per recipe, not the old 3-request nombre ->
  // descripcion_corta -> categoria cascade (dropped for tripping the burst
  // limiter). Tier 1 (precise) fires first; tier 2 (broad, see
  // `broadenQuery`) fires ONLY when tier 1 comes back with nothing, so a
  // still-viable precise match never gets diluted, and the extra request
  // only lands on recipes that were already going to fail otherwise.
  const results: { id: string, foto_url: string }[] = [];
  for (const recipe of recipes) {
    // "cooked meal food photography" bias: raw nombre alone too often
    // matches a raw-ingredient or product-photography stock shot (confirmed
    // live — "Arroz con magro y pimientos" returned a market bin of raw
    // peppers, zero rice, zero meat; "Sopa de tomate y albahaca" returned a
    // single raw tomato). Unsplash's tags/alt-text skew English, so an
    // explicit "cooked" disambiguator pushes results toward actual
    // prepared-meal photography instead of ingredient close-ups.
    // v6: `translateQuery` replaces the raw accent-stripped Spanish name —
    // see the file header for why (Spanish query into an English-tagged
    // database was the real root cause of bad matches, not just relevance
    // ranking).
    const preciseQuery = `${translateQuery(recipe.nombre)} cooked meal food photography`;
    // v11: broad tier had dropped the "cooked" disambiguator entirely (down
    // to just "food photography") to maximize corpus size — but FRESCO-192's
    // audit traced a real chunk of its mismatches back to exactly that:
    // raw-ingredient/product shots slipping through once "cooked" was gone.
    // Adding the single word back costs far less corpus width than the old
    // 2-word "cooked meal" precise-tier bias while still excluding the worst
    // offenders.
    const broadQuery = `${broadenQuery(recipe.nombre)} cooked food photography`;

    // v12 — provider fallback chain, tried in order, first hit wins. Each
    // provider gets its own precise + broad attempt before moving to the
    // next: Unsplash's tuning (content_filter, topK, page-2 exhaustion) is
    // the most battle-tested, so it goes first; Pexels/Pixabay only fire
    // once Unsplash's own corpus for this specific dish is confirmed empty,
    // not as a first-choice alternative.
    const attempts: { label: string, run: () => Promise<string | null> }[] = [
      { label: preciseQuery, run: async () => searchUnsplash(preciseQuery, recipe.id, usedUrls) },
      { label: `${broadQuery} [broad]`, run: async () => searchUnsplash(broadQuery, recipe.id, usedUrls) },
      { label: `${preciseQuery} [pexels]`, run: async () => searchPexels(preciseQuery, recipe.id, usedUrls) },
      { label: `${broadQuery} [pexels broad]`, run: async () => searchPexels(broadQuery, recipe.id, usedUrls) },
      { label: `${preciseQuery} [pixabay]`, run: async () => searchPixabay(preciseQuery, recipe.id, usedUrls) },
      { label: `${broadQuery} [pixabay broad]`, run: async () => searchPixabay(broadQuery, recipe.id, usedUrls) },
    ];

    let url: string | null = null;
    let query = '';
    for (const attempt of attempts) {
      url = await attempt.run();
      if (url) { query = attempt.label; break; }
    }

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
