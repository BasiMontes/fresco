import { describe, expect, test } from 'bun:test';
import { CONSENT_KINDS, CONSENT_TEXTS, isConsentKind, LEGAL_TEXTS_VERSION, parseConsentKinds } from './consent';

describe('isConsentKind', () => {
  test('accepts every declared kind and nothing else', () => {
    for (const kind of CONSENT_KINDS) {
      expect(isConsentKind(kind)).toBe(true);
    }
    expect(isConsentKind('marketing')).toBe(false);
    expect(isConsentKind('')).toBe(false);
    expect(isConsentKind(null)).toBe(false);
    expect(isConsentKind(42)).toBe(false);
  });
});

describe('parseConsentKinds', () => {
  test('returns the kinds, de-duplicated and in first-seen order', () => {
    expect(parseConsentKinds({ kinds: ['terms', 'privacy', 'terms', 'age_14'] })).toEqual(['terms', 'privacy', 'age_14']);
  });

  test.each([
    ['null', null],
    ['a string', 'terms'],
    ['an array', ['terms']],
    ['no kinds key', {}],
    ['kinds not an array', { kinds: 'terms' }],
    ['empty kinds', { kinds: [] }],
    ['an unknown kind', { kinds: ['terms', 'marketing'] }],
    ['a non-string kind', { kinds: [1] }],
    ['more kinds than exist', { kinds: [...CONSENT_KINDS, 'terms'] }],
  ])('returns null for %s', (_label, body) => {
    expect(parseConsentKinds(body)).toBeNull();
  });
});

describe('texts and version', () => {
  test('the version is non-empty and fits the column bound (1 to 60 characters)', () => {
    expect(LEGAL_TEXTS_VERSION.length).toBeGreaterThanOrEqual(1);
    expect(LEGAL_TEXTS_VERSION.length).toBeLessThanOrEqual(60);
  });

  test('the checkbox texts come from the lawyer draft and are not empty', () => {
    expect(CONSENT_TEXTS.age_14).toContain('14 años');
    expect(CONSENT_TEXTS.health_data).toContain('alergias');
    expect(CONSENT_TEXTS.withdrawal_waiver).toContain('desistimiento');
  });
});
