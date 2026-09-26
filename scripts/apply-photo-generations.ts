#!/usr/bin/env bun

// FRESCO-435 — last step of the manual Qwen Studio photo-generation
// workflow (see scripts/build-photo-prompts.ts header). Takes the prompts
// JSON that script produced plus a local folder of saved images, uploads
// each image to the `recipe-photos` Storage bucket (migration
// 20260926120000), and points the matching recipe's `foto_url` at the
// resulting public URL.
//
// Usage:
//   bun scripts/build-photo-prompts.ts 20 > /tmp/prompts.json
//   # ... generate + save each image as "<index>-<slug>.<ext>" in a folder ...
//   bun scripts/apply-photo-generations.ts /tmp/prompts.json ./generated-photos            # dry-run
//   bun scripts/apply-photo-generations.ts /tmp/prompts.json ./generated-photos --apply     # writes
//
// Dry-run by default (same convention as prune-duplicate-recipes.ts):
// prints what would be uploaded/applied without touching Storage or the DB.
//
// Safety: re-checks each recipe's CURRENT foto_url via service_role right
// before writing (not just the prompts.json snapshot) — a recipe can pick up
// a photo from a different pipeline (fetch-recipe-photos.ts, a manual fix)
// in the gap between generating prompts and applying images. Already-covered
// recipes are skipped, never overwritten silently.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');
const [, , promptsPathArg, folderArg] = process.argv;

interface PromptEntry {
  index: number
  id: string
  slug: string
  nombre: string
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

function contentTypeFor(ext: string): string {
  if (ext === 'jpg' || ext === 'jpeg') { return 'image/jpeg'; }
  if (ext === 'webp') { return 'image/webp'; }
  return 'image/png';
}

async function findImageFile(folder: string, entry: PromptEntry): Promise<string | null> {
  for (const ext of IMAGE_EXTENSIONS) {
    const path = `${folder}/${entry.index}-${entry.slug}.${ext}`;
    if (await Bun.file(path).exists()) { return path; }
  }
  return null;
}

async function currentFotoUrl(id: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/recipes?id=eq.${id}&select=foto_url`, {
    headers: { apikey: SERVICE_ROLE_KEY!, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`Fetch failed for ${id}: ${res.status} ${await res.text()}`);
  }
  const rows = await res.json() as { foto_url: string | null }[];
  return rows[0]?.foto_url ?? null;
}

async function uploadPhoto(id: string, filePath: string): Promise<string> {
  const ext = filePath.split('.').pop()!;
  const objectPath = `${id}.${ext}`;
  const bytes = await Bun.file(filePath).arrayBuffer();

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/recipe-photos/${objectPath}`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY!,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': contentTypeFor(ext),
      'x-upsert': 'true',
    },
    body: bytes,
  });
  if (!res.ok) {
    throw new Error(`Upload failed for ${objectPath}: ${res.status} ${await res.text()}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/recipe-photos/${objectPath}`;
}

async function applyFotoUrl(id: string, fotoUrl: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/recipes?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SERVICE_ROLE_KEY!,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ foto_url: fotoUrl }),
  });
  if (!res.ok) {
    throw new Error(`Update failed for ${id}: ${res.status} ${await res.text()}`);
  }
}

async function main() {
  if (!promptsPathArg || !folderArg) {
    console.error('Usage: bun scripts/apply-photo-generations.ts <prompts.json> <images-folder> [--apply]');
    process.exit(1);
  }
  if (!SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set in the environment.');
    process.exit(1);
  }

  const entries = JSON.parse(await Bun.file(promptsPathArg).text()) as PromptEntry[];

  let applied = 0;
  let missing = 0;
  let skippedAlreadyCovered = 0;

  for (const entry of entries) {
    const filePath = await findImageFile(folderArg, entry);
    if (!filePath) {
      console.error(`MISSING [${entry.index}] ${entry.nombre} — no "${entry.index}-${entry.slug}.<ext>" found in ${folderArg}`);
      missing++;
      continue;
    }

    const existing = await currentFotoUrl(entry.id);
    if (existing) {
      console.error(`SKIP    [${entry.index}] ${entry.nombre} — already has a photo (covered by another pipeline since prompts were generated)`);
      skippedAlreadyCovered++;
      continue;
    }

    if (!APPLY) {
      console.error(`DRY-RUN [${entry.index}] ${entry.nombre} — would upload ${filePath} and set foto_url`);
      applied++;
      continue;
    }

    const publicUrl = await uploadPhoto(entry.id, filePath);
    await applyFotoUrl(entry.id, publicUrl);
    console.error(`OK      [${entry.index}] ${entry.nombre} -> ${publicUrl}`);
    applied++;
  }

  console.error(`\n${APPLY ? 'Applied' : 'Would apply'} ${applied}, missing ${missing}, skipped (already covered) ${skippedAlreadyCovered}.`);
  if (!APPLY) { console.error('Dry-run only — pass --apply to upload and write foto_url.'); }
}

void main();
