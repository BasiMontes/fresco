import { describe, expect, test } from 'bun:test';
import { getMissingConsents, missingConsents, REQUIRED_CONSENTS } from './consent-status';

/** FRESCO-1007 — which of the required consents have no row at the current version. */

describe('missingConsents', () => {
  test('an account with no rows (it predates the registry) is missing all three', () => {
    expect(missingConsents([])).toEqual(['age_14', 'terms', 'privacy']);
  });

  test('rows of an older version count as missing', () => {
    const old = REQUIRED_CONSENTS.map(kind => ({ kind, version: 'old' }));
    expect(missingConsents(old, { version: 'current' })).toEqual(['age_14', 'terms', 'privacy']);
  });

  test('only the kinds without a current row are reported', () => {
    expect(missingConsents([{ kind: 'terms', version: 'v1' }], { version: 'v1' })).toEqual(['age_14', 'privacy']);
  });

  test('all three at the current version means nothing missing', () => {
    expect(missingConsents(REQUIRED_CONSENTS.map(kind => ({ kind, version: 'v1' })), { version: 'v1' })).toEqual([]);
  });

  test('a health_data row does not stand in for a required kind', () => {
    expect(missingConsents([{ kind: 'health_data', version: 'v1' }], { version: 'v1' })).toHaveLength(3);
  });
});

describe('missingConsents — health_data (FRESCO-1125)', () => {
  const required = REQUIRED_CONSENTS.map(kind => ({ kind, version: 'v1' }));

  test('a profile without allergens or halal is never asked for health_data', () => {
    expect(missingConsents(required, { version: 'v1', hasHealthData: false })).toEqual([]);
  });

  test('a profile with health data and no health_data row at the current version is asked', () => {
    expect(missingConsents(required, { version: 'v1', hasHealthData: true })).toEqual(['health_data']);
  });

  test('a health_data row of an older version does not count', () => {
    expect(missingConsents([...required, { kind: 'health_data', version: 'old' }], { version: 'v1', hasHealthData: true })).toEqual(['health_data']);
  });

  test('a health_data row at the current version means nothing missing', () => {
    expect(missingConsents([...required, { kind: 'health_data', version: 'v1' }], { version: 'v1', hasHealthData: true })).toEqual([]);
  });
});

describe('getMissingConsents', () => {
  function client(result: { data: unknown, error: unknown }, profile: { data: unknown, error: unknown } = { data: null, error: null }) {
    const builder = { select: () => builder, eq: () => builder, in: async () => result, maybeSingle: async () => profile };
    return { from: () => builder } as never;
  }

  test('throws on a read error so the layout can fail open', async () => {
    await expect(getMissingConsents(client({ data: null, error: new Error('db down') }))).rejects.toThrow('db down');
  });

  test('throws when the profile read fails, so the layout fails open too', async () => {
    await expect(getMissingConsents(client({ data: [], error: null }, { data: null, error: new Error('profile down') }))).rejects.toThrow('profile down');
  });

  test('treats a null result as no rows', async () => {
    expect(await getMissingConsents(client({ data: null, error: null }))).toEqual(['age_14', 'terms', 'privacy']);
  });

  test('asks for health_data when the profile holds allergens', async () => {
    const result = await getMissingConsents(client({ data: [], error: null }, { data: { alergenos: ['gluten'], dieta_halal: false }, error: null }));
    expect(result).toContain('health_data');
  });

  test('asks for health_data when the profile is halal', async () => {
    const result = await getMissingConsents(client({ data: [], error: null }, { data: { alergenos: [], dieta_halal: true }, error: null }));
    expect(result).toContain('health_data');
  });

  test('does not ask for health_data when the profile holds neither', async () => {
    const result = await getMissingConsents(client({ data: [], error: null }, { data: { alergenos: [], dieta_halal: false }, error: null }));
    expect(result).not.toContain('health_data');
  });
});
