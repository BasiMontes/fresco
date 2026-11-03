#!/usr/bin/env bun

// FRESCO-1084 — spike: generate recipe photos through Cloudflare Workers AI
// (FLUX.1 schnell, free plan ~230 images/day) instead of pasting prompts by
// hand into Qwen Studio (FRESCO-435).
//
// Input is the JSON that scripts/build-photo-prompts.ts prints; output is a
// folder of "<index>-<slug>.jpg" files, the exact naming that
// scripts/apply-photo-generations.ts expects. This script never touches
// Supabase or Storage.
//
// Usage:
//   bun scripts/build-photo-prompts.ts 8 > /tmp/prompts.json
//   bun scripts/generate-photos-cloudflare.ts /tmp/prompts.json ./generated-photos           # dry-run
//   bun scripts/generate-photos-cloudflare.ts /tmp/prompts.json ./generated-photos --apply   # calls the API
//
// Credentials are read by NAME from the environment, never printed:
//   CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (token needs "Workers AI" permission).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MODEL = '@cf/black-forest-labs/flux-1-schnell';
const MAX_PROMPT_CHARS = 2048; // flux-1-schnell input limit
// schnell accepts 1-8 steps and is designed for 1-4 (Cloudflare's default is 4).
// Cost per 1024x1024 image = 19.2 + 38.4 * steps neurons (Cloudflare pricing:
// 4.8 per 512x512 tile, 9.6 per step per tile), so 8 steps costs ~326 neurons
// and 4 steps ~173: the free 10,000 neurons/day gives ~30 vs ~57 images.
const MAX_STEPS = 8;
const FREE_NEURONS_PER_DAY = 10_000;
const stepsArg = Number(process.argv.find(a => a.startsWith('--steps='))?.split('=')[1] ?? 4);
const STEPS = Number.isInteger(stepsArg) && stepsArg >= 1 && stepsArg <= MAX_STEPS ? stepsArg : 4;
const NEURONS_PER_IMAGE = 19.2 + 38.4 * STEPS;
const DELAY_MS = 1500;
const MAX_ATTEMPTS = 3;

const APPLY = process.argv.includes('--apply');
const [, , promptsPathArg, folderArg] = process.argv;
// --candidates=N: N random samples per recipe, saved in
// <folder>/c1 ... <folder>/cN so a reviewer (or the vision-verify) can pick the
// best one. A single sample varies a lot (props, cropping, background), so
// picking among a few raises the yield without touching the model.
const CANDIDATES = Math.max(1, Number(process.argv.find(a => a.startsWith('--candidates='))?.split('=')[1] ?? 1));

interface PromptEntry {
  index: number
  id: string
  slug: string
  nombre: string
  prompt: string
}

interface CloudflareResponse {
  success: boolean
  result?: { image?: string }
  errors?: { code: number, message: string }[]
}

const DAILY_QUOTA_CODE = 4006;

class DailyQuotaError extends Error {
  constructor() {
    super('Cloudflare daily free allocation (10,000 neurons) is used up; it resets at 00:00 UTC. Rerun then: finished images are skipped.');
  }
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => { setTimeout(resolve, ms); });
}

async function generate(accountId: string, token: string, prompt: string): Promise<Buffer> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`;
  let lastError = 'unknown error';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, steps: STEPS }),
    });

    if (res.status === 429 || res.status >= 500) {
      // 429 with code 4006 is the daily free allocation (10,000 neurons, reset
      // 00:00 UTC), not a burst limit: retrying only burns time, so stop the run.
      const body = await res.json().catch(() => null) as CloudflareResponse | null;
      if (body?.errors?.some(e => e.code === DAILY_QUOTA_CODE)) { throw new DailyQuotaError(); }
      lastError = `HTTP ${res.status}`;
      await sleep(DELAY_MS * attempt * 2);
      continue;
    }

    const body = await res.json() as CloudflareResponse;
    if (!res.ok || !body.success || !body.result?.image) {
      const detail = body.errors?.map(e => `${e.code}: ${e.message}`).join('; ') ?? `HTTP ${res.status}`;
      throw new Error(detail);
    }
    return Buffer.from(body.result.image, 'base64');
  }

  throw new Error(`gave up after ${MAX_ATTEMPTS} attempts (${lastError})`);
}

async function main() {
  if (!promptsPathArg || !folderArg) {
    fail('Usage: bun scripts/generate-photos-cloudflare.ts <prompts.json> <output-folder> [--steps=1-8] [--candidates=N] [--apply]');
  }

  const entries = JSON.parse(readFileSync(promptsPathArg, 'utf8')) as PromptEntry[];
  const tooLong = entries.filter(e => e.prompt.length > MAX_PROMPT_CHARS);
  const images = entries.length * CANDIDATES;
  const neurons = Math.round(images * NEURONS_PER_IMAGE);
  console.error(`${entries.length} prompts x ${CANDIDATES} candidate(s), model ${MODEL}, steps ${STEPS}, ${APPLY ? 'APPLY' : 'dry-run'}`);
  console.error(`  estimate: ${images} images, ~${neurons} neurons (${Math.round(neurons / FREE_NEURONS_PER_DAY * 100)}% of the ${FREE_NEURONS_PER_DAY} free neurons/day; ~${Math.floor(FREE_NEURONS_PER_DAY / NEURONS_PER_IMAGE)} images/day at this step count)`);
  for (const e of tooLong) {
    console.error(`  WARN #${e.index} ${e.slug}: prompt ${e.prompt.length} chars > ${MAX_PROMPT_CHARS}, will be skipped`);
  }

  if (!APPLY) {
    for (const e of entries) {
      console.error(`  would generate #${e.index} ${e.slug} (${e.prompt.length} chars)`);
    }
    console.error('Dry-run only. Re-run with --apply to call the API.');
    return;
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) {
    fail('Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN in the environment (add them to .env, then restart the shell).');
  }

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  let quotaHit = false;

  for (const e of entries) {
    if (quotaHit) { break; }
    for (let candidate = 1; candidate <= CANDIDATES; candidate++) {
      const folder = CANDIDATES > 1 ? join(folderArg, `c${candidate}`) : folderArg;
      mkdirSync(folder, { recursive: true });
      const file = join(folder, `${e.index}-${e.slug}.jpg`);
      if (e.prompt.length > MAX_PROMPT_CHARS || existsSync(file)) {
        skipped++;
        continue;
      }
      // No `seed`: the REST endpoint of flux-1-schnell rejects it ("Additional
      // or unevaluated properties '/seed' not allowed"), so each call is a fresh
      // random sample and the candidates differ on their own.
      try {
        writeFileSync(file, await generate(accountId, token, e.prompt));
        ok++;
        console.error(`  ok #${e.index} ${e.slug}${CANDIDATES > 1 ? ` c${candidate}` : ''}`);
      }
      catch (error) {
        if (error instanceof DailyQuotaError) {
          console.error(`  STOPPED: ${error.message}`);
          quotaHit = true;
          break;
        }
        failed++;
        console.error(`  FAILED #${e.index} ${e.slug}${CANDIDATES > 1 ? ` c${candidate}` : ''}: ${(error as Error).message}`);
      }
      await sleep(DELAY_MS);
    }
  }

  console.error(`Done: ${ok} generated, ${skipped} skipped, ${failed} failed.`);
  if (failed > 0 || quotaHit) { process.exit(1); }
}

void main();
