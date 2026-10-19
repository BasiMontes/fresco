import { describe, expect, test } from 'bun:test';
import { getMissingConsents, missingConsents, REQUIRED_CONSENTS } from './consent-status';

/** FRESCO-1007 — which of the required consents have no row at the current version. */

describe('missingConsents', () => {
  test('an account with no rows (it predates the registry) is missing all three', () => {
    expect(missingConsents([])).toEqual(['age_14', 'terms', 'privacy']);
  });

  test('rows of an older version count as missing', () => {
    const old = REQUIRED_CONSENTS.map(kind => ({ kind, version: 'old' }));
    expect(missingConsents(old, 'current')).toEqual(['age_14', 'terms', 'privacy']);
  });

  test('only the kinds without a current row are reported', () => {
    expect(missingConsents([{ kind: 'terms', version: 'v1' }], 'v1')).toEqual(['age_14', 'privacy']);
  });

  test('all three at the current version means nothing missing', () => {
    expect(missingConsents(REQUIRED_CONSENTS.map(kind => ({ kind, version: 'v1' })), 'v1')).toEqual([]);
  });

  test('a health_data row does not stand in for a required kind', () => {
    expect(missingConsents([{ kind: 'health_data', version: 'v1' }], 'v1')).toHaveLength(3);
  });
});

describe('getMissingConsents', () => {
  function client(result: { data: unknown, error: unknown }) {
    const builder = { select: () => builder, eq: () => builder, in: async () => result };
    return { from: () => builder } as never;
  }

  test('throws on a read error so the layout can fail open', async () => {
    await expect(getMissingConsents(client({ data: null, error: new Error('db down') }))).rejects.toThrow('db down');
  });

  test('treats a null result as no rows', async () => {
    expect(await getMissingConsents(client({ data: null, error: null }))).toEqual(['age_14', 'terms', 'privacy']);
  });
});
