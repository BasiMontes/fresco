import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { getAccessToken } from '../test-helpers';

/**
 * Step definitions for `.context/qa/regression.feature` — @generacion-menu,
 * "La generación de menú es rápida y no depende de una llamada de IA por
 * franja (ADR-0005)".
 *
 * Uses the dedicated `PRO_TEST_USER_EMAIL` account specifically because it
 * has real cooked/discarded history — this exercises the WORST case for
 * ADR-0005's new flow (the one real Gemini call left, the Pro learning
 * explanation) alongside the deterministic 21-slot selection, not just the
 * fast Free-tier path. Reset-and-reseed convention matches
 * `entrega-parcial.steps.ts`/`calendario.steps.ts` for the same account.
 */

const { Given, When, Then } = createBdd(test);

// Generous margin over the ~2-3s observed live (including the Pro
// explanation call) — not tuned to a specific fast run, just proves this
// isn't the old 20-110s thinking-model latency.
const MAX_GENERATION_MS = 10_000;

let generationStartedAt = 0;

Given(/^que un usuario Pro con historial real completa el onboarding$/, async ({ page, request }) => {
  if (!process.env.PRO_TEST_USER_EMAIL || !process.env.PRO_TEST_USER_PASSWORD) {
    throw new Error('PRO_TEST_USER_EMAIL / PRO_TEST_USER_PASSWORD must be set in .env for this scenario.');
  }

  // Clears only the CURRENT week's plan so a fresh generation is possible
  // (409 otherwise) — the account's older weeks stay intact as the real
  // history `get_recent_recipe_ids()` reads for the explanation call.
  const accessToken = await getAccessToken(request, process.env.PRO_TEST_USER_EMAIL, process.env.PRO_TEST_USER_PASSWORD);
  const headers = {
    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    Authorization: `Bearer ${accessToken}`,
  };
  const now = new Date();
  const day = now.getUTCDay() || 7;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - day + 1);
  const fechaInicio = monday.toISOString().slice(0, 10);
  await request.delete(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/meal_plans?fecha_inicio=eq.${fechaInicio}`,
    { headers },
  );

  await page.goto('/login');
  await page.getByTestId('email_input').fill(process.env.PRO_TEST_USER_EMAIL);
  await page.getByTestId('password_input').fill(process.env.PRO_TEST_USER_PASSWORD);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL('**/menu');

  await page.goto('/onboarding');
  await page.getByTestId('next_button').click();
  await page.getByTestId('next_button').click();
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
