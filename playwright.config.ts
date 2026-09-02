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

// Defaults to local — override with `PLAYWRIGHT_BASE_URL` to point the suite
// at staging (`https://fresco-pre.vercel.app`) or production
// (`https://fresco-pro.vercel.app`), the same URLs `.agents/project.yaml`'s
// `environments.<env>.web_url` already declares.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir,
  // FRESCO-356 (ADR-0018 early-warning fired at 6m40s / 75 scenarios): the
  // four racer step files (@aprendizaje, @entrega-parcial,
  // @generacion-determinista, the aislamiento-datos @seguridad scenarios)
  // were migrated off the shared PRO_USER/DEV_USER accounts to
  // `testUserFactory` (FRESCO-308). Every scenario now provisions its own
  // throwaway user and seeds its own data, so nothing is shared and the
  // suite is safe to parallelise. `regression.feature` carries the
  // `@mode:parallel` playwright-bdd tag.
  //
  // The previous history (why this was `workers: 1` until now): running the
  // racers in parallel workers raced two scenarios onto the same finite
  // meal-plan slot — a "mark cocinado" test's own reload-check saw
  // "Descartado", clobbered by a concurrent "mark descartado" scenario
  // (ADR-0014). Factory isolation removes that class of race.
  fullyParallel: true,
  workers: process.env.CI ? 4 : 2,
  // Without this, `retries` defaults to 0 and `trace: 'on-first-retry'`
  // (below) never fires — a CI failure left no trace to debug from. One
  // retry in CI is enough to produce a trace on the failure that persists.
  retries: process.env.CI ? 1 : 0,
  // Playwright's own per-test timeout (default 30s) cuts a test short
  // before a longer `expect(...).toBeVisible({ timeout })` override even
  // gets to finish waiting. Kept generous even after generate-shopping-list
  // went fully deterministic (no more Gemini call) — other flows still do
  // real network round-trips worth headroom past the default.
  timeout: 90_000,
  // FRESCO-387 (A4-M14): `list` for the live log; on CI also emit an `html`
  // report and a `blob` bundle so the pr-check job can upload them as an
  // artifact — otherwise the `trace: 'on-first-retry'` zip is destroyed with
  // the runner and a flaky failure leaves nothing to debug from.
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['blob']]
    : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
