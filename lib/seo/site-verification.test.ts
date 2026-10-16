import { describe, expect, test } from 'bun:test';
import { getSiteVerification } from './site-verification';

/**
 * FRESCO-887 — Search Console and Bing Webmaster Tools verify ownership with a
 * meta tag whose value is a per-property code. The codes live in environment
 * variables, so the tags only exist once the owner has pasted them.
 */
describe('getSiteVerification', () => {
  test('returns nothing when no code is configured', () => {
    expect(getSiteVerification({})).toBeUndefined();
  });

  test('ignores empty and whitespace-only values', () => {
    expect(getSiteVerification({
      GOOGLE_SITE_VERIFICATION: '',
      BING_SITE_VERIFICATION: '   ',
    })).toBeUndefined();
  });

  test('emits the Google tag on its own', () => {
    expect(getSiteVerification({ GOOGLE_SITE_VERIFICATION: 'g-code' })).toEqual({ google: 'g-code' });
  });

  test('emits the Bing tag as msvalidate.01 on its own', () => {
    expect(getSiteVerification({ BING_SITE_VERIFICATION: 'b-code' })).toEqual({
      other: { 'msvalidate.01': 'b-code' },
    });
  });

  test('emits both and trims surrounding whitespace', () => {
    expect(getSiteVerification({
      GOOGLE_SITE_VERIFICATION: ' g-code\n',
      BING_SITE_VERIFICATION: ' b-code ',
    })).toEqual({
      google: 'g-code',
      other: { 'msvalidate.01': 'b-code' },
    });
  });
});
