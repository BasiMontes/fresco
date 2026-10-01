#!/usr/bin/env bun

// FRESCO-751 — measures the REAL mobile LCP of a page under applied
// throttling (slow 4G network + 4x slower CPU, the same profile as Lighthouse
// mobile), cold on every run, and fails when the median exceeds the budget.
//
// Why not plain Lighthouse: its default "simulated" throttling computes LCP
// from a model and was measured to swing between 1.6 s and 3.4 s on the same
// deployment (FRESCO-751). Applied throttling measures what a device sees.
//
// Usage:
//   bun scripts/measure-lcp.ts                       # production
//   bun scripts/measure-lcp.ts --url=http://localhost:3000 --runs=5 --budget=2500
//   bun scripts/measure-lcp.ts --channel=chrome      # use the installed Chrome

import { chromium } from '@playwright/test';

const DEFAULT_URL = 'https://fresco-pro.vercel.app/';
const DEFAULT_RUNS = 5;
const DEFAULT_BUDGET_MS = 2500;

// Lighthouse mobile "slow 4G" profile.
const LATENCY_MS = 150;
const DOWNLOAD_BYTES_PER_S = (1.6 * 1024 * 1024) / 8;
const UPLOAD_BYTES_PER_S = (750 * 1024) / 8;
const CPU_SLOWDOWN = 4;

// Time after `load` to let the LCP candidate settle before reading it.
const SETTLE_MS = 2000;

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function arg(name: string, fallback: string): string {
  return process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
}

async function measureOnce(url: string, channel: string): Promise<number> {
  const browser = await chromium.launch({ headless: true, channel: channel || undefined });
  try {
    const context = await browser.newContext({
      viewport: { width: 412, height: 823 },
      deviceScaleFactor: 1.75,
      isMobile: true,
      hasTouch: true,
      locale: 'es-ES',
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: LATENCY_MS,
      downloadThroughput: DOWNLOAD_BYTES_PER_S,
      uploadThroughput: UPLOAD_BYTES_PER_S,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });

    await page.addInitScript(() => {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        (window as unknown as { __lcp: number }).__lcp = entries[entries.length - 1].startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });

    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(SETTLE_MS);
    const lcp = await page.evaluate(() => (window as unknown as { __lcp?: number }).__lcp);
    if (lcp === undefined) { throw new Error('No LCP entry was recorded'); }
    return Math.round(lcp);
  }
  finally {
    await browser.close();
  }
}

if (import.meta.main) {
  const url = arg('url', DEFAULT_URL);
  const runs = Number(arg('runs', String(DEFAULT_RUNS)));
  const budget = Number(arg('budget', String(DEFAULT_BUDGET_MS)));
  const channel = arg('channel', '');

  const samples: number[] = [];
  for (let i = 1; i <= runs; i++) {
    const lcp = await measureOnce(url, channel);
    samples.push(lcp);
    console.log(`run ${i}/${runs}: LCP ${lcp} ms`);
  }

  const med = median(samples);
  console.log(`\n${url}\nmedian LCP ${med} ms (budget ${budget} ms) over ${runs} cold runs: ${samples.join(', ')}`);
  if (med > budget) {
    console.error(`::error::Median LCP ${med} ms exceeds the ${budget} ms budget.`);
    process.exit(1);
  }
}
