import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { clearSlowAttempt, previousSlowAttempt, recordSlowAttempt } from '../latency-guard';
import { loginToApp } from '../test-helpers';
import { seedLastWeekCookedHistory } from '../test-user-factory';

/**
 * Step definitions for `.context/qa/regression.feature` — @generacion-menu,
 * "La generación de menú es rápida y no depende de una llamada de IA por
 * franja (ADR-0005)".
 *
 * FRESCO-356: migrated off the shared `PRO_USER` account. A throwaway Pro
 * factory user (FRESCO-308) is seeded with a real "last week, all cocinada"
 * history — this exercises the WORST case (the one remaining Gemini call,
 * the Pro learning explanation) alongside the deterministic 21-slot
 * selection, not just the fast Free path.
 *
 * FRESCO-930 (audit A4-L17): `retries: 1` in CI re-runs the whole scenario with a
 * fresh stopwatch, so a slow first attempt followed by a fast retry used to pass.
 * A slow attempt now leaves a marker (`tests/latency-guard.ts`, one per Playwright
 * project, because a retry runs in a new worker) and the last step of ANY later
 * attempt fails while it exists. Other flakes are still retried as before.
 *
 * The `pulsa "Ver resumen" y luego "Empezar"` step is shared with `onboarding.steps.ts`
 * (Cucumber matches step text across every loaded file) — defined here.
 */

const { Given, When, Then } = createBdd(test);

const MAX_GENERATION_MS = 10_000;
let generationStartedAt = 0;

/** The marker is per Playwright project: the three projects can run this scenario in parallel. */
function slowAttemptTarget() {
  return { key: test.info().project.name };
}

Given(/^que un usuario Pro con historial real completa el onboarding$/, async ({ page, request, testUserFactory }) => {
  test.setTimeout(60_000);
  // A fresh run (not a retry) must not inherit a marker from an earlier run.
  if (test.info().retry === 0) {
    clearSlowAttempt(slowAttemptTarget());
  }
  const testUser = await testUserFactory({ plan: 'pro' });
  await seedLastWeekCookedHistory(request, testUser);

  await loginToApp(page, testUser);

  await page.goto('/onboarding');
  // FRESCO-371: 3-step wizard — 2 clicks reaches the final step.
  await page.getByTestId('next_button').click();
  await page.getByTestId('next_button').click();
  await page.getByTestId('presupuesto_input').fill('80');
});

// FRESCO-755: step 3's CTA is "Ver resumen"; generation starts from the
// summary's "Empezar", so the clock starts there.
When(/^pulsa "Ver resumen" y luego "Empezar"$/, async ({ page }) => {
  await page.getByTestId('view_summary_button').click();
  generationStartedAt = Date.now();
  await page.getByTestId('generate_menu_button').click();
});

Then(/^el menú completo queda listo en menos de 10 segundos$/, async ({ page }) => {
  try {
    await page.waitForURL('**/menu', { timeout: MAX_GENERATION_MS });
  }
  catch (error) {
    // Not reaching /menu inside the limit IS the slow case: remember it so a
    // fast retry cannot erase it.
    recordSlowAttempt({ ...slowAttemptTarget(), elapsedMs: Date.now() - generationStartedAt });
    throw error;
  }
  const elapsedMs = Date.now() - generationStartedAt;
  if (elapsedMs > MAX_GENERATION_MS) {
    recordSlowAttempt({ ...slowAttemptTarget(), elapsedMs });
    throw new Error(`La generación tardó ${elapsedMs}ms, por encima del umbral de ${MAX_GENERATION_MS}ms.`);
  }

  // A retry that is fast must not hide that an earlier attempt of this scenario was not.
  const earlierMs = previousSlowAttempt(slowAttemptTarget());
  if (earlierMs !== null) {
    throw new Error(`Un intento anterior de este escenario tardó ${earlierMs}ms, por encima del umbral de ${MAX_GENERATION_MS}ms; el reintento no lo borra.`);
  }
});
