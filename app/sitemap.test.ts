import { afterEach, describe, expect, test } from 'bun:test';
import sitemap from './sitemap';

const originalEnv = process.env.VERCEL_ENV;

afterEach(() => {
  if (originalEnv === undefined) { delete process.env.VERCEL_ENV; }
  else { process.env.VERCEL_ENV = originalEnv; }
});

describe('sitemap', () => {
  test('never lists /design-system (FRESCO-1207)', () => {
    process.env.VERCEL_ENV = 'production';
    const entries = sitemap();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some(entry => entry.url.includes('/design-system'))).toBe(false);
  });
});
