import type { E2eRun } from './e2e-wallclock';
import { describe, expect, test } from 'bun:test';
import { EARLY_WARNING_SECONDS, evaluateWallclock, formatDuration, HARD_TRIGGER_SECONDS, parseLimit } from './e2e-wallclock';

/**
 * FRESCO-1280 — the ADR-0018 trigger is "two consecutive runs above the threshold", so the cases worth pinning are
 * the edges of that sentence: adjacent versus separated, strictly above versus exactly at, and what an unreadable
 * window answers (never "fine"). The GitHub reading is not tested here; it is a thin wrapper over `gh`.
 */

const runs = (...seconds: number[]): E2eRun[] => seconds.map((value, index) => ({ runId: index + 1, finishedAt: '2026-11-24T08:00:00Z', seconds: value }));

describe('evaluateWallclock', () => {
  test('ok when every run is under the early warning', () => {
    expect(evaluateWallclock(runs(300, 340, 365, 387)).verdict).toBe('ok');
  });

  test('one run above the early warning is not enough, it has to be sustained', () => {
    expect(evaluateWallclock(runs(300, 400, 310)).verdict).toBe('ok');
  });

  test('two runs above the early warning that are not adjacent do not count', () => {
    expect(evaluateWallclock(runs(400, 310, 400)).verdict).toBe('ok');
  });

  test('two adjacent runs above the early warning fire it', () => {
    expect(evaluateWallclock(runs(300, 395, 410, 310)).verdict).toBe('early-warning');
  });

  test('a run exactly at the threshold has not crossed it', () => {
    expect(evaluateWallclock(runs(EARLY_WARNING_SECONDS, EARLY_WARNING_SECONDS)).verdict).toBe('ok');
    expect(evaluateWallclock(runs(EARLY_WARNING_SECONDS + 1, EARLY_WARNING_SECONDS + 1)).verdict).toBe('early-warning');
  });

  test('two adjacent runs above the hard trigger fire the hard one, which wins over the early warning', () => {
    expect(evaluateWallclock(runs(300, HARD_TRIGGER_SECONDS + 1, HARD_TRIGGER_SECONDS + 5)).verdict).toBe('hard-trigger');
  });

  test('one run above the hard trigger next to one only above the early warning is the early warning', () => {
    expect(evaluateWallclock(runs(HARD_TRIGGER_SECONDS + 10, 400)).verdict).toBe('early-warning');
  });

  test('fewer than two runs cannot show a sustained crossing: insufficient data, never ok', () => {
    expect(evaluateWallclock(runs()).verdict).toBe('insufficient-data');
    expect(evaluateWallclock(runs(500)).verdict).toBe('insufficient-data');
  });

  test('reports the mean and the max of the window', () => {
    expect(evaluateWallclock(runs(300, 360, 390))).toMatchObject({ mean: 350, max: 390 });
  });

  test('takes custom thresholds', () => {
    expect(evaluateWallclock(runs(200, 210), { early: 190, hard: 400 }).verdict).toBe('early-warning');
  });
});

describe('formatDuration', () => {
  test('minutes and zero-padded seconds, or just seconds under a minute', () => {
    expect(formatDuration(370)).toBe('6m10s');
    expect(formatDuration(480)).toBe('8m00s');
    expect(formatDuration(59)).toBe('59s');
  });
});

describe('parseLimit', () => {
  test('defaults to 12 and reads --limit', () => {
    expect(parseLimit([])).toBe(12);
    expect(parseLimit(['--limit', '30'])).toBe(30);
  });

  test('refuses a window smaller than a pair, or a non-number', () => {
    expect(() => parseLimit(['--limit', '1'])).toThrow('at least 2');
    expect(() => parseLimit(['--limit', 'x'])).toThrow('at least 2');
    expect(() => parseLimit(['--limit'])).toThrow('at least 2');
  });
});
