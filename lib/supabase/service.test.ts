import * as supabaseJs from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { clientEnv } from '@/lib/env';

// A variable specifier: `tsc` cannot resolve a query string, bun can, and the query keeps other files' mocks out.
const REAL_MODULE = './service?real';

// FRESCO-1080 — the service-role client bypasses RLS, so it must fail loudly when its key is missing
// instead of silently building a client that talks to the database with the wrong credentials.
// Loaded under its own query string: other test files replace this module for the whole run.

// `server-only` throws on purpose outside a server bundle; under `bun test` there is no bundler to resolve it.
void mock.module('server-only', () => ({}));

const saved = process.env.SUPABASE_SERVICE_ROLE_KEY;
let createSpy: ReturnType<typeof spyOn<typeof supabaseJs, 'createClient'>>;

beforeEach(() => {
  createSpy = spyOn(supabaseJs, 'createClient').mockReturnValue({ marker: 'service' } as never);
});

afterEach(() => {
  createSpy.mockRestore();
  if (saved === undefined) { delete process.env.SUPABASE_SERVICE_ROLE_KEY; }
  else { process.env.SUPABASE_SERVICE_ROLE_KEY = saved; }
});

describe('createServiceClient', () => {
  test('builds a client from the public URL and the service-role key', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
    const { createServiceClient } = await import(REAL_MODULE) as typeof import('./service');

    expect(createServiceClient()).toEqual({ marker: 'service' });
    expect(createSpy).toHaveBeenCalledWith(clientEnv.NEXT_PUBLIC_SUPABASE_URL, 'service-role-test-key');
  });

  test('throws, and builds nothing, when the key is not set', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { createServiceClient } = await import(REAL_MODULE) as typeof import('./service');

    expect(() => createServiceClient()).toThrow('SUPABASE_SERVICE_ROLE_KEY is required');
    expect(createSpy).not.toHaveBeenCalled();
  });
});
