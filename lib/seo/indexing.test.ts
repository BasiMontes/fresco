import { describe, expect, test } from 'bun:test';
import robots from '../../app/robots';
import sitemap from '../../app/sitemap';
import { indexingRobots, isIndexable } from './indexing';

/**
 * FRESCO-1018 (audit 7b, A7-LAUNCH-07/08): `fresco-pre` and `fresco-dev` served the same `Allow: /` as
 * production and competed with it in search. Only `VERCEL_ENV=production` may be indexed.
 */

const ENV_KEYS = ['VERCEL_ENV', 'VERCEL_GIT_COMMIT_REF'] as const;

/** Runs `fn` with the Vercel env set as given, then restores it. */
function withEnv<T>(env: Partial<Record<(typeof ENV_KEYS)[number], string>>, fn: () => T): T {
  const saved = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]));
  for (const key of ENV_KEYS) { delete process.env[key]; }
  Object.assign(process.env, env);
  try {
    return fn();
  }
  finally {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) { delete process.env[key]; }
      else { process.env[key] = saved[key]; }
    }
  }
}

describe('isIndexable', () => {
  test('is true on the production deployment only', () => {
    expect(isIndexable({ VERCEL_ENV: 'production' })).toBe(true);
  });

  test.each(['preview', 'development', '', undefined])('is false for VERCEL_ENV=%p, so pre, dev and local stay closed', (value) => {
    expect(isIndexable({ VERCEL_ENV: value })).toBe(false);
  });
});

describe('indexingRobots (root layout metadata)', () => {
  test('adds nothing on production', () => {
    expect(indexingRobots({ VERCEL_ENV: 'production' })).toBeUndefined();
  });

  test('is noindex, nofollow everywhere else', () => {
    expect(indexingRobots({ VERCEL_ENV: 'preview' })).toEqual({ index: false, follow: false });
    expect(indexingRobots({})).toEqual({ index: false, follow: false });
  });
});

describe('robots.txt', () => {
  test('production allows the marketing surface and points at the sitemap', () => {
    const result = withEnv({ VERCEL_ENV: 'production' }, () => robots());

    expect(result.sitemap).toBe('https://fresco-pro.vercel.app/sitemap.xml');
    expect(result.rules).toMatchObject({ userAgent: '*', allow: '/' });
  });

  test.each([['pre', { VERCEL_ENV: 'preview' }], ['dev', { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'dev' }], ['local', {}]])('%s disallows everything and lists no sitemap', (_name, env) => {
    const result = withEnv(env, () => robots());

    expect(result.rules).toEqual({ userAgent: '*', disallow: '/' });
    expect(result.sitemap).toBeUndefined();
  });
});

describe('sitemap.xml', () => {
  test('production lists the landing and the four legal pages (A7-LAUNCH-08)', () => {
    const urls = withEnv({ VERCEL_ENV: 'production' }, () => sitemap()).map(entry => entry.url);

    expect(urls).toEqual([
      'https://fresco-pro.vercel.app',
      'https://fresco-pro.vercel.app/legal/privacidad',
      'https://fresco-pro.vercel.app/legal/terminos',
      'https://fresco-pro.vercel.app/legal/cookies',
      'https://fresco-pro.vercel.app/legal/contacto',
    ]);
  });

  test('a closed site lists nothing', () => {
    expect(withEnv({ VERCEL_ENV: 'preview' }, () => sitemap())).toEqual([]);
    expect(withEnv({}, () => sitemap())).toEqual([]);
  });
});
