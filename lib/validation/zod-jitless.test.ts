import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { config, z } from 'zod';
import './zod-jitless';

/** FRESCO-1042: no `new Function` probe from Zod in the browser, so no CSP report before consent. */
describe('zod jitless', () => {
  test('turns the JIT probe off', () => {
    expect(config().jitless).toBe(true);
  });

  test('validation still works with it off', () => {
    const schema = z.object({ email: z.string().email(), age: z.number().int().min(0) });
    expect(schema.safeParse({ email: 'a@b.es', age: 3 }).success).toBe(true);
    expect(schema.safeParse({ email: 'nope', age: -1 }).success).toBe(false);
  });

  test('instrumentation-client.ts loads it, so it runs before any schema in the browser', () => {
    const source = readFileSync(join(import.meta.dir, '..', '..', 'instrumentation-client.ts'), 'utf8');
    expect(source).toContain('@/lib/validation/zod-jitless');
  });
});
