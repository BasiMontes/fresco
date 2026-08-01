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
  // Scoped to exactly the scenarios that have real step definitions — the
  // `regression.feature` header's own convention is to add `@automatizado`
  // whenever a scenario gets a step file, so that tag alone is the correct
  // filter (self-maintaining: a new automated scenario just needs the tag,
  // no edit here). An epic-slug-based filter (@login, @aprendizaje, ...)
  // looked simpler at first but broke bddgen the moment a new scenario
  // shared a slug with an already-automated one but had no steps yet — an
  // unconditional epic tag doesn't imply "has steps".
  tags: '@automatizado',
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
  // Playwright's own per-test timeout (default 30s) cuts a test short
  // before a longer `expect(...).toBeVisible({ timeout })` override even
  // gets to finish waiting. Kept generous even after generate-shopping-list
  // went fully deterministic (no more Gemini call) — other flows still do
  // real network round-trips worth headroom past the default.
  timeout: 90_000,
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
