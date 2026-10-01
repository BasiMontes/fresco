import { describe, expect, test } from 'bun:test';
import { datasetAgeDays, isStale, MAX_AGE_DAYS } from './check-mercadona-dataset-freshness';

describe('datasetAgeDays', () => {
  test('counts whole days between the last update and now', () => {
    const now = new Date('2026-10-01T12:00:00Z');
    expect(datasetAgeDays('2026-09-21T02:45:43.000Z', now)).toBe(10);
  });

  test('is 0 for an update earlier the same day', () => {
    const now = new Date('2026-10-01T12:00:00Z');
    expect(datasetAgeDays('2026-10-01T02:00:00.000Z', now)).toBe(0);
  });
});

describe('isStale', () => {
  test('a dataset updated within the limit is fresh', () => {
    expect(isStale(0)).toBe(false);
    expect(isStale(MAX_AGE_DAYS)).toBe(false);
  });

  test('a dataset older than the limit is stale', () => {
    expect(isStale(MAX_AGE_DAYS + 1)).toBe(true);
  });

  test('an unparseable date counts as stale (fail-closed)', () => {
    expect(isStale(datasetAgeDays('not-a-date', new Date()))).toBe(true);
  });
});
