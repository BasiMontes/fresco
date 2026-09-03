import { GlobalRegistrator } from '@happy-dom/global-registrator';

/**
 * FRESCO-409 — registers happy-dom's `window`/`document`/etc. as globals
 * for every `bun test` file (Bun has no per-file test environment like
 * Vitest). See ADR-0024.
 *
 * This runs in its OWN preload module, listed BEFORE `bun-test-setup.ts` in
 * `bunfig.toml`, because `@testing-library/*` binds `document.body` at
 * import-eval time — any file that imports testing-library (including the
 * other setup module) must not be evaluated until `document` exists.
 *
 * `url` gives `window.location` a real origin so `lib` code that branches
 * on `typeof window` takes the browser path under test, same as the app.
 */
GlobalRegistrator.register({ url: 'https://test.fresco.local/' });
