import { afterEach, describe, expect, test } from 'bun:test';
import robots from './robots';

const originalEnv = process.env.VERCEL_ENV;

afterEach(() => {
  if (originalEnv === undefined) { delete process.env.VERCEL_ENV; }
  else { process.env.VERCEL_ENV = originalEnv; }
});

describe('robots', () => {
  test('production disallows /design-system (FRESCO-1207)', () => {
    process.env.VERCEL_ENV = 'production';
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    expect(rule?.disallow).toContain('/design-system');
  });
});
