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
 * (`adultos: 2`, full `planning_selection`) already make every step valid, so
 * with FRESCO-371 (budget optional) nothing needs filling to reach "Generar
 * mi menú" — same as `generacion-determinista.steps.ts`, whose `pulsa
 * "Generar mi menú"` step this scenario reuses.
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
  // FRESCO-371: 3-step wizard (cuisines folded into the diet step). 2 clicks
  // reaches step 3 where household + planning + the (now optional) budget +
  // generate live. Budget filled here to exercise the value path.
  await page.getByTestId('next_button').click();
  await page.getByTestId('next_button').click();
  await page.getByTestId('presupuesto_input').fill('80');
});

Then(/^el indicador de pasos del onboarding dice "Paso 1 de 3"$/, async ({ page }) => {
  await page.goto('/onboarding');
  await expect(page.getByTestId('step_indicator_label')).toHaveText(/Paso\s+1\s+de\s+3/);
});

When(/^llega al último paso sin rellenar el presupuesto y pulsa "Generar mi menú"$/, async ({ page }) => {
  // FRESCO-371: 2 clicks reach step 3; budget left blank (optional).
  await page.getByTestId('next_button').click();
  await page.getByTestId('next_button').click();
  await expect(page.getByTestId('presupuesto_input')).toHaveValue('');
  await page.getByTestId('generate_menu_button').click();
});

Then(/^la IA genera un menú de 21 huecos \(7 días x desayuno\/comida\/cena\)$/, async ({ page, request }) => {
  // FRESCO-421: 90s for the same cold-start reason as the `/calendar`
  // generation step (calendario-semana.steps.ts) — the first
  // `generate-meal-plan` call on a CI worker boots the local Deno Edge
  // Runtime and can exceed 30s. Bounded by playwright.config.ts's 90s
  // per-test timeout.
  await page.waitForURL('**/menu', { timeout: 90_000 });
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

// ── @edge-case scenarios (FRESCO-463) ────────────────────────────────────

async function loginAsFreshUser(
  page: import('@playwright/test').Page,
  testUserFactory: import('../test-user-factory').TestUserFactory,
): Promise<void> {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await page.goto('/login');
  await page.getByTestId('email_input').fill(testUser.email);
  await page.getByTestId('password_input').fill(testUser.password);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL(url => /\/(?:menu|onboarding)/.test(url.pathname));
}

// "Recargar a mitad del onboarding no borra el progreso" — FRESCO-94:
// `lib/store/onboarding-store.ts` persists `step` + every answer to
// sessionStorage via zustand persist, so an F5 mid-wizard restores exactly
// where the user was.

Given(/^que el usuario completó el paso 1 o 2 del onboarding$/, async ({ page, testUserFactory }) => {
  await loginAsFreshUser(page, testUserFactory);
  await page.goto('/onboarding');
  await expect(page.getByTestId('step_indicator_label')).toHaveText(/Paso\s+1\s+de\s+3/);
  await page.getByTestId('next_button').click();
  await expect(page.getByTestId('step_indicator_label')).toHaveText(/Paso\s+2\s+de\s+3/);
  // Real progress to lose: toggle the first diet chip.
  await page.getByTestId('dieta_option').first().click();
  await expect(page.getByTestId('dieta_option').first()).toHaveAttribute('aria-pressed', 'true');
});

When(/^recarga la página antes de llegar al paso 3$/, async ({ page }) => {
  await page.reload();
});

Then(/^sus respuestas ya dadas siguen ahí, no vuelve al paso 1 en blanco$/, async ({ page }) => {
  await expect(page.getByTestId('step_indicator_label')).toHaveText(/Paso\s+2\s+de\s+3/);
  await expect(page.getByTestId('dieta_option').first()).toHaveAttribute('aria-pressed', 'true');
});

// "El campo Adultos respeta un tope superior" — FRESCO-110: `validateHousehold`
// caps adultos/niños at `HOUSEHOLD_FIELD_MAX` (10); over that, the inline
// message shows AND `generate_menu_button` is disabled
// (`disabled={... || !household.valid || ...}`).

Given(/^que el usuario está en el paso 3 del onboarding \(hogar\)$/, async ({ page, testUserFactory }) => {
  await loginAsFreshUser(page, testUserFactory);
  await page.goto('/onboarding');
  await expect(page.getByTestId('step_indicator_label')).toBeVisible();
  await page.getByTestId('next_button').click();
  await page.getByTestId('next_button').click();
  await expect(page.getByTestId('adultos_input')).toBeVisible();
});

When(/^escribe un valor muy grande \(ej\. 999\) en "Adultos"$/, async ({ page }) => {
  await page.getByTestId('adultos_input').fill('999');
});

Then(/^el sistema lo rechaza o lo acota a un máximo razonable antes de permitir generar el menú$/, async ({ page }) => {
  await expect(page.getByTestId('household_validation_message')).toBeVisible();
  await expect(page.getByTestId('generate_menu_button')).toBeDisabled();
});
