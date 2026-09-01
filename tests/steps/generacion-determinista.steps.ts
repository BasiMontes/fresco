import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
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
 * The `pulsa "Generar mi menú"` step is shared with `onboarding.steps.ts`
 * (Cucumber matches step text across every loaded file) — defined here.
 */

const { Given, When, Then } = createBdd(test);

const MAX_GENERATION_MS = 10_000;
let generationStartedAt = 0;

Given(/^que un usuario Pro con historial real completa el onboarding$/, async ({ page, request, testUserFactory }) => {
  test.setTimeout(60_000);
  const testUser = await testUserFactory({ plan: 'pro' });
  await seedLastWeekCookedHistory(request, testUser);

  await page.goto('/login');
  await page.getByTestId('email_input').fill(testUser.email);
  await page.getByTestId('password_input').fill(testUser.password);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL(url => /\/(?:menu|onboarding)/.test(url.pathname));

  await page.goto('/onboarding');
  // FRESCO-371: 3-step wizard — 2 clicks reaches the final step.
  await page.getByTestId('next_button').click();
  await page.getByTestId('next_button').click();
  await page.getByTestId('presupuesto_input').fill('80');
});

When(/^pulsa "Generar mi menú"$/, async ({ page }) => {
  generationStartedAt = Date.now();
  await page.getByTestId('generate_menu_button').click();
});

Then(/^el menú completo queda listo en menos de 10 segundos$/, async ({ page }) => {
  await page.waitForURL('**/menu', { timeout: MAX_GENERATION_MS });
  const elapsedMs = Date.now() - generationStartedAt;
  if (elapsedMs > MAX_GENERATION_MS) {
    throw new Error(`La generación tardó ${elapsedMs}ms, por encima del umbral de ${MAX_GENERATION_MS}ms.`);
  }
});
