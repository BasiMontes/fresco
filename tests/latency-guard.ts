import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * FRESCO-930 (audit A4-L17) — remembers that an earlier attempt of an e2e
 * scenario was too slow, across Playwright retries.
 *
 * `retries: 1` in CI re-runs the whole scenario, stopwatch included, so a slow
 * first attempt followed by a fast retry passed and hid a latency regression
 * behind the flaky-budget warning. A retry runs in a fresh worker process, so
 * module state is lost; a small file in the temp directory is what survives.
 *
 * One file per `key` (the Playwright project name), so the `chromium`,
 * `mobile` and `tablet` projects can run the same scenario in parallel without
 * seeing each other's marker.
 */

interface GuardTarget {
  /** Playwright project name. Anything outside `[a-z0-9_-]` is replaced, so a name cannot escape `dir`. */
  key: string
  /** Where the marker lives. Defaults to the OS temp directory. */
  dir?: string
}

function markerPath({ key, dir = tmpdir() }: GuardTarget): string {
  return join(dir, `fresco-e2e-slow-attempt-${key.replace(/[^\w-]/g, '_')}`);
}

/** Start of a fresh run (`retry === 0`): forget a marker left by an earlier run. */
export function clearSlowAttempt(target: GuardTarget): void {
  rmSync(markerPath(target), { force: true });
}

/** An attempt went over the limit: keep the slowest time seen so far. */
export function recordSlowAttempt({ elapsedMs, ...target }: GuardTarget & { elapsedMs: number }): void {
  const earlier = previousSlowAttempt(target);
  writeFileSync(markerPath(target), String(earlier === null ? elapsedMs : Math.max(earlier, elapsedMs)));
}

/** Elapsed time of an earlier slow attempt of this scenario, or `null` when none was recorded. */
export function previousSlowAttempt(target: GuardTarget): number | null {
  const file = markerPath(target);
  if (!existsSync(file)) {
    return null;
  }
  const elapsedMs = Number(readFileSync(file, 'utf8'));
  return Number.isFinite(elapsedMs) ? elapsedMs : null;
}
