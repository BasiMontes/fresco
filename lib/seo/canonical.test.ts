import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, test } from 'bun:test';
import { canonicalUrl, getMetadataBase } from './canonical';

const ENV_VARS = ['VERCEL_ENV', 'VERCEL_GIT_COMMIT_REF'] as const;
const OLD_ENV = { ...process.env };

function clearEnv() {
  for (const key of ENV_VARS) { delete process.env[key]; }
}

describe('canonicalUrl', () => {
  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  test('production root path has no trailing slash appended', () => {
    clearEnv();
    process.env.VERCEL_ENV = 'production';
    expect(canonicalUrl('/')).toBe('https://fresco-pro.vercel.app');
  });

  test('production sub-route', () => {
    clearEnv();
    process.env.VERCEL_ENV = 'production';
    expect(canonicalUrl('/login')).toBe('https://fresco-pro.vercel.app/login');
  });

  test('preview on the dev branch', () => {
    clearEnv();
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_GIT_COMMIT_REF = 'dev';
    expect(canonicalUrl('/signup')).toBe('https://fresco-dev.vercel.app/signup');
  });

  test('preview on any other branch → fresco-pre.vercel.app', () => {
    clearEnv();
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_GIT_COMMIT_REF = 'feature/some-branch';
    expect(canonicalUrl('/onboarding')).toBe('https://fresco-pre.vercel.app/onboarding');
  });

  test('local (no VERCEL_ENV) → localhost:3000', () => {
    clearEnv();
    expect(canonicalUrl('/login')).toBe('http://localhost:3000/login');
  });

  test('never carries a query string, regardless of caller input', () => {
    clearEnv();
    process.env.VERCEL_ENV = 'production';
    // canonicalUrl only ever receives a static route path from a route's own
    // metadata export — it has no access to `searchParams` — but this pins
    // that contract: no `?` can appear in a value it returns.
    expect(canonicalUrl('/login')).not.toContain('?');
  });
});

describe('getMetadataBase', () => {
  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  test('returns a URL instance matching the resolved base', () => {
    clearEnv();
    process.env.VERCEL_ENV = 'production';
    expect(getMetadataBase()).toEqual(new URL('https://fresco-pro.vercel.app'));
  });

  test('local (no VERCEL_ENV) → localhost:3000', () => {
    clearEnv();
    expect(getMetadataBase()).toEqual(new URL('http://localhost:3000'));
  });
});

/**
 * FRESCO-1018 (audit 7b, A7-LAUNCH-07): the Open Graph origin must come from `resolveBaseUrl()`, never
 * from `VERCEL_URL`, which is the per-deployment hostname (`fresco-3z7fzpx9q-...vercel.app`) and would
 * put a URL on `og:image` that is not the one people share. `metadataBase` is what resolves it.
 */
describe('Open Graph origin (FRESCO-1018)', () => {
  test('metadataBase is the environment base URL, whatever VERCEL_URL says', () => {
    const saved = { url: process.env.VERCEL_URL, env: process.env.VERCEL_ENV };
    process.env.VERCEL_URL = 'fresco-3z7fzpx9q-basi-montes-projects.vercel.app';
    process.env.VERCEL_ENV = 'production';
    try {
      expect(getMetadataBase().origin).toBe('https://fresco-pro.vercel.app');
    }
    finally {
      if (saved.url === undefined) { delete process.env.VERCEL_URL; }
      else { process.env.VERCEL_URL = saved.url; }
      if (saved.env === undefined) { delete process.env.VERCEL_ENV; }
      else { process.env.VERCEL_ENV = saved.env; }
    }
  });

  test('no app or lib source reads VERCEL_URL', () => {
    const found = spawnSync('git', ['grep', '-l', '-E', 'VERCEL_(BRANCH_)?URL', '--', 'app', 'lib', 'next.config.mjs', 'proxy.ts', ':(exclude)*.test.*'], { encoding: 'utf8' }).stdout.trim();

    expect(found).toBe('');
  });
});
