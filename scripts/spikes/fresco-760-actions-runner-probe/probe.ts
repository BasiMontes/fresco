#!/usr/bin/env bun

// FRESCO-760 spike — can a GitHub Actions runner reach each supermarket's
// public catalog, or does the chain's antibot block datacenter IPs?
//
// Throwaway probe. NOT wired into the app. One GET per chain, spaced out, no
// data stored: it only records the response code, latency, size and any
// antibot signal. ADR-0028 still gates production use; this spike does not
// call any endpoint beyond a single public page per chain.
//
// Usage:
//   bun scripts/spikes/fresco-760-actions-runner-probe/probe.ts --mode=http
//   bun scripts/spikes/fresco-760-actions-runner-probe/probe.ts --mode=browser
//
// Prints a markdown table (paste into the README) and exits 0 regardless of
// results: a blocked chain is a finding, not a failure.

import { chromium } from '@playwright/test';

type Mode = 'http' | 'browser';

interface Target {
  chain: string
  url: string
  // 'api' = known JSON catalog endpoint, 'page' = public HTML landing page
  kind: 'api' | 'page'
}

interface Result {
  chain: string
  kind: Target['kind']
  status: number | 'error'
  ms: number
  bytes: number
  signal: string
}

const TARGETS: Target[] = [
  { chain: 'Mercadona', url: 'https://tienda.mercadona.es/api/categories/', kind: 'api' },
  { chain: 'Carrefour', url: 'https://www.carrefour.es/supermercado', kind: 'page' },
  { chain: 'Dia', url: 'https://www.dia.es/compra-online', kind: 'page' },
  { chain: 'Alcampo', url: 'https://www.compraonline.alcampo.es/', kind: 'page' },
  { chain: 'Lidl', url: 'https://www.lidl.es/', kind: 'page' },
  { chain: 'Bonpreu', url: 'https://www.compraonline.bonpreuesclat.cat/', kind: 'page' },
];

const DELAY_MS = 3000;

// Case-insensitive markers a block page or challenge usually carries.
const BLOCK_MARKERS = [
  'access denied',
  'captcha',
  'just a moment',
  'attention required',
  'pardon our interruption',
  'unusual traffic',
  'akamai',
  'request blocked',
];

// A real catalog page is hundreds of KB and mentions "captcha" / "akamai" in
// its own scripts. A block or challenge page is small, so markers only count
// below this size; above it a 2xx is treated as a clean response.
const BLOCK_PAGE_MAX_BYTES = 30000;

function detectSignal(status: number, body: string): string {
  if (status === 429) { return 'rate-limited (429)'; }
  if (status === 403) { return 'forbidden (403)'; }
  if (body.length < BLOCK_PAGE_MAX_BYTES) {
    const lower = body.toLowerCase();
    const hit = BLOCK_MARKERS.find(marker => lower.includes(marker));
    if (hit) { return `block marker: "${hit}"`; }
  }
  return status >= 200 && status < 300 ? 'none' : `unexpected status ${status}`;
}

async function probeHttp(target: Target): Promise<Result> {
  const started = performance.now();
  try {
    const response = await fetch(target.url, { redirect: 'follow' });
    const body = await response.text();
    return {
      chain: target.chain,
      kind: target.kind,
      status: response.status,
      ms: Math.round(performance.now() - started),
      bytes: body.length,
      signal: detectSignal(response.status, body),
    };
  }
  catch (error) {
    return {
      chain: target.chain,
      kind: target.kind,
      status: 'error',
      ms: Math.round(performance.now() - started),
      bytes: 0,
      signal: error instanceof Error ? error.message : String(error),
    };
  }
}

async function probeBrowser(targets: Target[]): Promise<Result[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'es-ES' });
  const results: Result[] = [];
  try {
    for (const target of targets) {
      const page = await context.newPage();
      const started = performance.now();
      try {
        const response = await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const body = await page.content();
        const status = response?.status() ?? 0;
        results.push({
          chain: target.chain,
          kind: target.kind,
          status,
          ms: Math.round(performance.now() - started),
          bytes: body.length,
          signal: detectSignal(status, body),
        });
      }
      catch (error) {
        results.push({
          chain: target.chain,
          kind: target.kind,
          status: 'error',
          ms: Math.round(performance.now() - started),
          bytes: 0,
          signal: error instanceof Error ? error.message : String(error),
        });
      }
      await page.close();
      await Bun.sleep(DELAY_MS);
    }
  }
  finally {
    await browser.close();
  }
  return results;
}

function toMarkdown(mode: Mode, results: Result[]): string {
  const rows = results.map(r => `| ${r.chain} | ${r.kind} | ${r.status} | ${r.ms} | ${r.bytes} | ${r.signal} |`);
  return [
    `Mode: \`${mode}\` · runner: \`${process.env.RUNNER_NAME ?? 'local'}\` (${process.env.RUNNER_ENVIRONMENT ?? 'local'})`,
    '',
    '| Chain | Kind | Status | ms | bytes | Signal |',
    '|---|---|---|---|---|---|',
    ...rows,
  ].join('\n');
}

async function main() {
  const modeArg = process.argv.find(arg => arg.startsWith('--mode='))?.split('=')[1];
  const mode: Mode = modeArg === 'browser' ? 'browser' : 'http';

  let results: Result[] = [];
  if (mode === 'browser') {
    results = await probeBrowser(TARGETS);
  }
  else {
    for (const target of TARGETS) {
      results.push(await probeHttp(target));
      await Bun.sleep(DELAY_MS);
    }
  }

  const table = toMarkdown(mode, results);
  console.log(table);

  // GitHub Actions renders this on the run summary page.
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    await Bun.write(summaryPath, `${table}\n`);
  }
}

await main();
