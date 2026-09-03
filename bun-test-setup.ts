import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { afterEach, beforeEach, mock } from 'bun:test';

/**
 * FRESCO-409 — component tests (`*.test.tsx`) need a DOM. Bun has no
 * per-file test environment like Vitest, so happy-dom is registered here in
 * the preload. See ADR-0024.
 *
 * `@testing-library/*` binds `document.body` at import-eval time and ESM
 * `import` hoists above executable code, so testing-library is pulled in
 * via `require()` further down, AFTER the first register call — never a
 * top-level import here.
 *
 * The `beforeEach` re-check is the CI fix: on the GitHub Actions runner the
 * preload's global `window` did not survive to test-file execution
 * (`ReferenceError: window is not defined` from react-dom), though it does
 * locally. Re-asserting the DOM before every test makes it deterministic
 * regardless of what bun does to globals between the preload and each file.
 * `tests/component-render.tsx` exports a `screen` that re-derives from the
 * live `document.body` each access, so it survives a re-register too.
 *
 * `url` gives `window.location` a real origin so `lib` code that branches on
 * `typeof window` takes the browser path under test, same as the app.
 */
const HAPPY_DOM_URL = 'https://test.fresco.local/';

// First registration — window is definitely absent and the registrator's
// flag is unset here, so a plain sync call is enough.
GlobalRegistrator.register({ url: HAPPY_DOM_URL });
if (typeof globalThis.window === 'undefined') {
  throw new TypeError('bun-test-setup: happy-dom did not install a window global');
}

// Re-assert the DOM before every test. On the GitHub Actions runner the
// preload's global `window` did not survive to test-file execution, though
// it does locally — this makes it deterministic regardless of what bun does
// to globals between the preload and each file. The registrator's static
// "registered" flag can stay set while the global is gone, and `register()`
// throws in that state, so unregister first.
beforeEach(async () => {
  if (typeof globalThis.window !== 'undefined') {
    return;
  }
  if (GlobalRegistrator.isRegistered) {
    await GlobalRegistrator.unregister();
  }
  GlobalRegistrator.register({ url: HAPPY_DOM_URL });
});

/**
 * `lib/env.ts` validates the NEXT_PUBLIC_* client env at first read and
 * throws "copy .env.example to .env" when unset. `bun test` auto-loads a
 * local `.env`, so it is silent locally — but CI's `test:unit` job has no
 * `.env`, which broke the 12 `lib/api/edge-functions.test.ts` cases (they
 * read `process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL` for their own
 * assertions). Deterministic dummies, only when nothing real is present.
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL ||= 'https://test.functions.supabase.co';

/**
 * posthog-js's browser bundle attaches DOM listeners at import time
 * (autocapture bootstrap) and crashes under Bun's test runner on Linux CI
 * (`t.addEventListener is not a function`) even though it's silent locally.
 * lib/posthog/events.test.ts only asserts our own fail-soft wrapper, never
 * real SDK behavior (see that file's own docstring) — a lightweight stub is
 * the correct fix, not a DOM shim.
 */
void mock.module('posthog-js', () => ({
  default: {
    capture: () => ({ uuid: '', event: '', properties: {} }),
    identify: () => {},
    alias: () => {},
    get_distinct_id: () => null,
    init: () => {},
  },
}));

/**
 * `@/lib/supabase/client` pulls `@supabase/ssr` + `@supabase/supabase-js`
 * (a large graph). Mocking it ONCE here — rather than per component-test
 * file — avoids bun re-invalidating and re-transpiling that whole graph on
 * every file that needs a stub client, which turned a <1s suite into a 75s
 * one. No non-component test imports this module. Component tests that need
 * to assert on client calls `spyOn` the specific `@/lib/api/*` function
 * instead; the ones that never reach a network call just get this inert
 * client (its reads resolve to "no session", which is a real branch).
 */
void mock.module('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: null } }),
      getUser: async () => ({ data: { user: null } }),
      signInWithPassword: async () => ({ data: { session: null }, error: new Error('no test backend') }),
      signOut: async () => ({ error: null }),
    },
  }),
}));

// Pulled in AFTER GlobalRegistrator.register() — see the header note.
// eslint-disable-next-line ts/no-require-imports
const { cleanup } = require('@testing-library/react') as typeof import('@testing-library/react');
// eslint-disable-next-line ts/no-require-imports
require('@testing-library/jest-dom');

/**
 * RTL does not auto-clean under `bun test` (the runner wires no afterEach of
 * its own), so unmount between tests to keep the shared happy-dom document
 * from accumulating rendered trees across cases.
 */
afterEach(() => {
  cleanup();
});
