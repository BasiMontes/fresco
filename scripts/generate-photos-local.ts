#!/usr/bin/env bun

// FRESCO-1084 — generates recipe photos on this Mac with mflux (MLX) running
// FLUX.1 schnell, instead of a metered cloud API. No daily quota, no cost, and
// seeds work, so every candidate is reproducible.
//
// Input is the JSON that scripts/build-photo-prompts.ts prints; output is a
// folder of "<index>-<slug>.png" files, the naming scripts/apply-photo-generations.ts
// expects. This script never touches Supabase or Storage.
//
// One-time setup (about 9 GB of model files in ~/.cache/huggingface):
//   uv tool install mflux          # puts mflux-generate in ~/.local/bin
//
// Usage:
//   bun scripts/build-photo-prompts.ts 30 > /tmp/prompts.json
//   bun scripts/generate-photos-local.ts /tmp/prompts.json ./generated-photos            # dry-run
//   caffeinate -i bun scripts/generate-photos-local.ts /tmp/prompts.json ./generated-photos --apply
//
// Measured on an Apple M3 16 GB (2026-11-03): ~150 s per 1024x1024 image on AC
// power with Low Power Mode off, ~300 s on battery. Keep the Mac plugged in and
// awake (`caffeinate -i`). Reruns skip images that already exist.
//
// The 4-bit weights come from a third-party Hugging Face repo (Apache-2.0 per
// its model card), not from Black Forest Labs: that official repo is 53 GB.

import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const MODEL = 'dhairyashil/FLUX.1-schnell-mflux-4bit';
const BASE_MODEL = 'schnell';
const PER_IMAGE_TIMEOUT_MS = 15 * 60 * 1000;
const SECONDS_PER_IMAGE_ESTIMATE = 150;

const APPLY = process.argv.includes('--apply');
const [, , promptsPathArg, folderArg] = process.argv;

function numberFlag(name: string, fallback: number): number {
  const raw = process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
  const value = raw === undefined ? fallback : Number(raw);
  return Number.isInteger(value) && value >= 1 ? value : fallback;
}

// --size=768 trades resolution for speed (roughly half the time of 1024).
const SIZE = numberFlag('size', 1024);
const STEPS = numberFlag('steps', 4);
const CANDIDATES = numberFlag('candidates', 1);

interface PromptEntry {
  index: number
  id: string
  slug: string
  nombre: string
  prompt: string
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function findBinary(): string {
  const onPath = Bun.which('mflux-generate');
  if (onPath) { return onPath; }
  const fallback = join(homedir(), '.local', 'bin', 'mflux-generate');
  if (existsSync(fallback)) { return fallback; }
  return fail('mflux-generate not found. Install it with: uv tool install mflux');
}

async function powerSource(): Promise<string> {
  const proc = Bun.spawn(['pmset', '-g', 'batt'], { stdout: 'pipe', stderr: 'ignore' });
  const text = await new Response(proc.stdout).text();
  return text.split('\n')[0]?.trim() ?? 'unknown power source';
}

async function generate(binary: string, entry: PromptEntry, seed: number, outputPath: string): Promise<void> {
  // Arguments go as an array, never through a shell: a prompt can hold quotes.
  const proc = Bun.spawn([
    binary,
    '--low-ram',
    '--model',
    MODEL,
    '--base-model',
    BASE_MODEL,
    '--steps',
    String(STEPS),
    '--width',
    String(SIZE),
    '--height',
    String(SIZE),
    '--seed',
    String(seed),
    '--output',
    outputPath,
    '--prompt',
    entry.prompt,
  ], { stdout: 'ignore', stderr: 'pipe', timeout: PER_IMAGE_TIMEOUT_MS });

  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;
  if (code !== 0 || !existsSync(outputPath)) {
    const lastLine = stderr.trim().split('\n').at(-1) ?? 'no output';
    throw new Error(`mflux exited with ${code}: ${lastLine}`);
  }
}

async function main() {
  if (!promptsPathArg || !folderArg) {
    fail('Usage: bun scripts/generate-photos-local.ts <prompts.json> <output-folder> [--size=1024] [--steps=4] [--candidates=N] [--apply]');
  }

  const entries = JSON.parse(await Bun.file(promptsPathArg).text()) as PromptEntry[];
  const images = entries.length * CANDIDATES;
  const hours = (images * SECONDS_PER_IMAGE_ESTIMATE * (SIZE / 1024) ** 2) / 3600;
  console.error(`${entries.length} prompts x ${CANDIDATES} candidate(s), ${SIZE}x${SIZE}, steps ${STEPS}, ${APPLY ? 'APPLY' : 'dry-run'}`);
  console.error(`  estimate: ${images} images, ~${hours.toFixed(1)} h on an M3 16 GB plugged in`);

  if (!APPLY) {
    console.error('Dry-run only. Re-run with --apply to generate.');
    return;
  }

  const binary = findBinary();
  const power = await powerSource();
  console.error(`  power: ${power}`);
  if (power.includes('Battery Power')) {
    console.error('  WARN: on battery the run is about twice as slow; plug in the charger and turn Low Power Mode off.');
  }

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of entries) {
    for (let candidate = 1; candidate <= CANDIDATES; candidate++) {
      const folder = CANDIDATES > 1 ? join(folderArg, `c${candidate}`) : folderArg;
      mkdirSync(folder, { recursive: true });
      const file = join(folder, `${entry.index}-${entry.slug}.png`);
      const label = `#${entry.index} ${entry.slug}${CANDIDATES > 1 ? ` c${candidate}` : ''}`;
      if (existsSync(file)) {
        skipped++;
        continue;
      }
      const started = Date.now();
      try {
        // Fixed seed per (recipe, candidate): a rerun reproduces the same image.
        await generate(binary, entry, entry.index * 1000 + candidate, file);
        ok++;
        console.error(`  ok ${label} (${Math.round((Date.now() - started) / 1000)} s)`);
      }
      catch (error) {
        failed++;
        console.error(`  FAILED ${label}: ${(error as Error).message}`);
      }
    }
  }

  console.error(`Done: ${ok} generated, ${skipped} skipped, ${failed} failed.`);
  if (failed > 0) { process.exit(1); }
}

void main();
