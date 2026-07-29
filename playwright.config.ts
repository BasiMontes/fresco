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
  steps: 'tests/steps/*.ts',
  // Scoped to the one scenario this suite currently automates. `@login` also
  // tags a second, `@edge-case`/`@pendiente` scenario in the same feature
  // file that has no step definitions yet — excluding it keeps bddgen from
  // failing on "missing step definitions" for scenarios not yet automated.
  tags: '@login and not @edge-case',
});

export default defineConfig({
  testDir,
  fullyParallel: true,
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
