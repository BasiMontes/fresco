import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

/**
 * playwright-bdd generates real Playwright test files from the Gherkin
 * `.feature` files listed below, at config-load time. The `.feature` file
 * itself stays the single source of truth (`.context/qa/regression.feature`)
 * — no hand-translated duplicate spec.
 */
const testDir = defineBddConfig({
  features: '.context/qa/regression.feature',
  // tests/fixtures.ts must be in this glob (not just imported by the step
  // files) so bddgen's auto-detection can resolve the one shared custom
  // `test` instance signup.steps.ts and aprendizaje.steps.ts both use — see
  // tests/fixtures.ts's header for why a shared instance is needed at all.
  steps: ['tests/fixtures.ts', 'tests/steps/*.ts'],
  // Scoped to the scenarios this suite currently automates (@login,
  // @registro, @aprendizaje). @login/@registro each have an untouched
  // `@edge-case` sibling scenario with no step definitions yet, so those two
  // tags stay `and not @edge-case`; @aprendizaje's own edge-case scenarios
  // (terminal-lock-on-reload, Free-tier notice) DO have steps (see
  // tests/steps/aprendizaje.steps.ts) so they're included unconditionally.
  tags: '((@login or @registro) and not @edge-case) or @aprendizaje',
});

export default defineConfig({
  testDir,
  // @aprendizaje's scenarios all mutate the same shared, finite, real test
  // plan (each picks "the first still-pendiente slot") — running them in
  // parallel workers raced two scenarios onto the same slot (found live: a
  // "mark cocinado" test's own reload-check saw "Descartado", clobbered by
  // a concurrent "mark descartado" scenario). Single worker trades a bit of
  // speed for correctness against shared mutable backend state; this suite
  // is small enough that it doesn't matter yet.
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
