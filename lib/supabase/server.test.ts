import * as ssr from '@supabase/ssr';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { clientEnv } from '@/lib/env';
import { cookieBehaviour, cookieWrites, headersState } from '@/tests/mocks/next-headers';

// A variable specifier: `tsc` cannot resolve a query string, bun can, and the query keeps other files' mocks out.
const REAL_MODULE = './server?real';

// FRESCO-1080 — the cookie-bound client every Server Component and Route Handler reads the session
// through. The contract: it is built from the public env, it reads the request cookies, and writing a
// refreshed session cookie from a Server Component render (where Next forbids it) must not throw.
//
// Loaded under its own query string: other test files replace '@/lib/supabase/server' for the whole run.
interface CookieOptions { cookies: { getAll: () => unknown, setAll: (cookies: Array<{ name: string, value: string, options?: unknown }>) => void } }

let createSpy: ReturnType<typeof spyOn<typeof ssr, 'createServerClient'>>;

beforeEach(() => {
  headersState.cookies = {};
  cookieWrites.length = 0;
  cookieBehaviour.setThrows = false;
  createSpy = spyOn(ssr, 'createServerClient').mockReturnValue({ marker: 'client' });
});

afterEach(() => {
  createSpy.mockRestore();
  headersState.cookies = {};
  cookieBehaviour.setThrows = false;
});

async function build() {
  const { createClient } = await import(REAL_MODULE) as typeof import('./server');
  const client = await createClient();
  const options = createSpy.mock.calls[0][2] as unknown as CookieOptions;
  return { client, options };
}

describe('createClient (server)', () => {
  test('builds the client from the public Supabase URL and anon key', async () => {
    const { client } = await build();

    expect(client).toEqual({ marker: 'client' });
    expect(createSpy.mock.calls[0][0]).toBe(clientEnv.NEXT_PUBLIC_SUPABASE_URL);
    expect(createSpy.mock.calls[0][1]).toBe(clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  });

  test('reads the session from the request cookies', async () => {
    headersState.cookies = { 'sb-access-token': 'tok', 'other': 'x' };
    const { options } = await build();

    expect(options.cookies.getAll()).toEqual([{ name: 'sb-access-token', value: 'tok' }, { name: 'other', value: 'x' }]);
  });

  test('writes a refreshed session cookie through the cookie store', async () => {
    const { options } = await build();

    options.cookies.setAll([{ name: 'sb-access-token', value: 'new', options: { path: '/' } }, { name: 'b', value: '2' }]);

    expect(cookieWrites).toEqual([
      { name: 'sb-access-token', value: 'new', options: { path: '/' } },
      { name: 'b', value: '2', options: undefined },
    ]);
  });

  test('a write refused during a Server Component render is swallowed, middleware refreshes the session instead', async () => {
    cookieBehaviour.setThrows = true;
    const { options } = await build();

    expect(() => options.cookies.setAll([{ name: 'a', value: '1' }])).not.toThrow();
    expect(cookieWrites).toEqual([]);
  });
});
