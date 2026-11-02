import { mock } from 'bun:test';

/**
 * FRESCO-1079 — shared `next/headers` stub for tests of Server Components that read cookies or
 * request headers. `mock.module` is process-global, so two test files registering their own
 * version of the same module would overwrite each other depending on load order. Registering it
 * here, once, and importing it for the side effect (same pattern as `./next-navigation.ts`) keeps
 * one version for the whole run.
 *
 * Set `headersState.cookies` / `headersState.headers` before rendering; reset them in a `beforeEach`.
 */
export const headersState: { cookies: Record<string, string>, headers: Record<string, string> } = { cookies: {}, headers: {} };

/** Every `cookies().set(...)` the code under test made, in order; `setThrows` makes `set` throw like a Server Component render does. */
export const cookieWrites: Array<{ name: string, value: string, options?: unknown }> = [];
export const cookieBehaviour = { setThrows: false };

void mock.module('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name in headersState.cookies ? { name, value: headersState.cookies[name] } : undefined),
    getAll: () => Object.entries(headersState.cookies).map(([name, value]) => ({ name, value })),
    set: (name: string, value: string, options?: unknown) => {
      if (cookieBehaviour.setThrows) { throw new Error('Cookies can only be modified in a Server Action or Route Handler'); }
      cookieWrites.push({ name, value, options });
    },
  }),
  headers: async () => ({
    get: (name: string) => headersState.headers[name] ?? null,
  }),
}));
