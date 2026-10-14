import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { clearSlowAttempt, previousSlowAttempt, recordSlowAttempt } from './latency-guard';

/**
 * FRESCO-930 (audit A4-L17) — the generation scenario asserts "menu ready in
 * under 10 s", but `retries: 1` in CI re-runs the whole scenario with a fresh
 * stopwatch, so a slow first attempt followed by a fast retry used to pass.
 * A retry runs in a new worker process, so the slow attempt leaves a marker
 * file the next attempt can read. These tests pin that mechanism; the e2e
 * scenario itself cannot be forced slow without distorting it.
 */

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'latency-guard-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('latency guard', () => {
  test('nothing recorded means no earlier slow attempt', () => {
    expect(previousSlowAttempt({ key: 'chromium', dir })).toBeNull();
  });

  test('a recorded slow attempt is visible to the next attempt with its elapsed time', () => {
    recordSlowAttempt({ key: 'chromium', dir, elapsedMs: 12_345 });

    expect(previousSlowAttempt({ key: 'chromium', dir })).toBe(12_345);
  });

  test('clearing at the start of a fresh run drops a marker left by an earlier run', () => {
    recordSlowAttempt({ key: 'chromium', dir, elapsedMs: 12_345 });

    clearSlowAttempt({ key: 'chromium', dir });

    expect(previousSlowAttempt({ key: 'chromium', dir })).toBeNull();
  });

  test('clearing when nothing was recorded does not throw', () => {
    expect(() => clearSlowAttempt({ key: 'chromium', dir })).not.toThrow();
  });

  test('projects do not see each other\'s marker, so the three Playwright projects can run in parallel', () => {
    recordSlowAttempt({ key: 'mobile', dir, elapsedMs: 11_000 });

    expect(previousSlowAttempt({ key: 'chromium', dir })).toBeNull();
    expect(previousSlowAttempt({ key: 'tablet', dir })).toBeNull();
    expect(previousSlowAttempt({ key: 'mobile', dir })).toBe(11_000);
  });

  test('a later slow attempt keeps the slowest time', () => {
    recordSlowAttempt({ key: 'chromium', dir, elapsedMs: 15_000 });
    recordSlowAttempt({ key: 'chromium', dir, elapsedMs: 11_000 });

    expect(previousSlowAttempt({ key: 'chromium', dir })).toBe(15_000);
  });

  test('a project name with unsafe characters cannot escape the directory', () => {
    recordSlowAttempt({ key: '../../etc/x', dir, elapsedMs: 10_500 });

    expect(previousSlowAttempt({ key: '../../etc/x', dir })).toBe(10_500);
    expect(previousSlowAttempt({ key: 'x', dir })).toBeNull();
  });
});
