import type { TestUser } from '../test-user-factory';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { currentWeekMonday, restHeaders } from '../test-helpers';

/**
 * Step definitions for `.context/qa/regression.feature` — @onboarding
 * @generacion-menu, "Un usuario logueado completa el onboarding y genera su
 * menú semanal".
 *
 * FRESCO-352 (ratchet de FRESCO-321). The core happy path the whole product
 * hangs on: onboarding → first generated week. Uses a throwaway factory user
 * (FRESCO-308) with no prior plan. The onboarding store's defaults
 * (`adultos: 2`, full `planning_selection`) already make steps 2–3 valid, so
 * only the required weekly budget on step 4 needs filling — same as
 * `generacion-determinista.steps.ts`, whose `pulsa "Generar mi menú"` step
 * this scenario reuses.
 */

const { Given, When, Then } = createBdd(test);

interface Ctx { testUser: TestUser | null }
const ctx: Ctx = { testUser: null };

Given(/^que el usuario tiene sesión iniciada$/, async ({ page, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await page.goto('/login');
  await page.getByTestId('email_input').fill(testUser.email);
  await page.getByTestId('password_input').fill(testUser.password);
  await page.getByTestId('login_submit_button').click();
  // A fresh user with no onboarding data lands on /onboarding; one that
  // somehow already has a plan lands on /menu. Either is a valid signed-in
  // state — the next step navigates to /onboarding explicitly.
  await page.waitForURL(url => /\/(?:menu|onboarding)/.test(url.pathname));
});

Given(/^no tiene todavía un menú generado para la semana actual$/, async ({ request }) => {
  const testUser = ctx.testUser!;
  const { semanaIso } = currentWeekMonday();
  const res = await request.get(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/meal_plans?user_id=eq.${testUser.id}&semana_iso=eq.${semanaIso}`,
    { headers: restHeaders(testUser.accessToken) },
  );
  expect(await res.json()).toEqual([]);
});

When(/^completa los 3 pasos del onboarding \(dieta\/alérgenos, cocinas favoritas, hogar\)$/, async ({ page }) => {
  await page.goto('/onboarding');
  await expect(page.getByTestId('step_indicator_label')).toBeVisible();
  // 4-step wizard (identity split out since generacion-determinista.steps.ts
  // was written); 3 clicks reaches step 4 where the budget + generate live.
  await page.getByTestId('next_button').click();
  await page.getByTestId('next_button').click();
  await page.getByTestId('next_button').click();
  await page.getByTestId('presupuesto_input').fill('80');
});

Then(/^la IA genera un menú de 21 huecos \(7 días x desayuno\/comida\/cena\)$/, async ({ page, request }) => {
  await page.waitForURL('**/menu', { timeout: 30_000 });
  const testUser = ctx.testUser!;
  const { semanaIso } = currentWeekMonday();
  const headers = restHeaders(testUser.accessToken);

  const planRes = await request.get(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/meal_plans?select=id&user_id=eq.${testUser.id}&semana_iso=eq.${semanaIso}`,
    { headers },
  );
  const [plan] = await planRes.json() as { id: string }[];
  expect(plan).toBeTruthy();

  const slotsRes = await request.get(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/meal_plan_recipes?select=id&meal_plan_id=eq.${plan.id}`,
    { headers },
  );
  expect((await slotsRes.json() as unknown[]).length).toBe(21);
});

Then(/^el menú queda persistido en base de datos$/, async () => {
  // Asserted by the 21-slot DB read in the previous Then — this row keeps
  // the Gherkin one-to-one with the step file.
  expect(ctx.testUser).toBeTruthy();
});

Then(/^es redirigido a \/menu, donde ve el menú completo$/, async ({ page }) => {
  await expect(page).toHaveURL(/\/menu$/);
  await expect(page.getByTestId('menu_empty_state')).toHaveCount(0);
});
