#!/usr/bin/env bun

// FRESCO-762 — fails when the community Mercadona dataset behind
// `lib/grocery/mercadona-catalog.generated.ts` has not been updated for too
// long. The dataset (`datania/mercadona-catalog`) is exported every Monday;
// if it stalls, a weekly refresh would silently regenerate the same stale
// prices. Run before `gen-mercadona-catalog.ts` in the refresh workflow so
// the job fails loudly (and GitHub notifies) instead of looking healthy.
//
// Usage:
//   bun scripts/check-mercadona-dataset-freshness.ts

const DATASET_API = 'https://huggingface.co/api/datasets/datania/mercadona-catalog';
const MS_PER_DAY = 86_400_000;

/** Two missed Monday exports. One missed week is normal slack; two is a stall. */
export const MAX_AGE_DAYS = 14;

export function datasetAgeDays(lastModified: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(lastModified).getTime()) / MS_PER_DAY);
}

/** Fail-closed: an unparseable date (NaN) counts as stale, never as fresh. */
export function isStale(ageDays: number, maxAgeDays: number = MAX_AGE_DAYS): boolean {
  return !(ageDays <= maxAgeDays);
}

if (import.meta.main) {
  const res = await fetch(DATASET_API);
  if (!res.ok) {
    console.error(`::error::Could not read the dataset metadata (${res.status}).`);
    process.exit(1);
  }
  const { lastModified } = await res.json() as { lastModified: string };
  const age = datasetAgeDays(lastModified, new Date());

  if (isStale(age)) {
    console.error(
      `::error::The Mercadona dataset was last updated ${lastModified} (${age} days ago, limit ${MAX_AGE_DAYS}). Refresh skipped.`,
    );
    process.exit(1);
  }
  console.log(`Dataset last updated ${lastModified} (${age} days ago). OK.`);
}
