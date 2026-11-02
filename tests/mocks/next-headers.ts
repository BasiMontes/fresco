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

void mock.module('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name in headersState.cookies ? { name, value: headersState.cookies[name] } : undefined),
  }),
  headers: async () => ({
    get: (name: string) => headersState.headers[name] ?? null,
  }),
}));
