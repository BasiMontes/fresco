import type { Page } from '@playwright/test';
import type { TestUser } from '../test-user-factory';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { restHeaders } from '../test-helpers';
import { seedFullWeekMenu } from '../test-user-factory';

/**
 * Step definitions for `.context/qa/regression.feature` — @biblioteca,
 * "añadir al menú" from a Biblioteca card (FRESCO-878):
 *   - "Añadir una receta de la Biblioteca al menú"
 *   - "Solo se ofrecen huecos del mismo tipo de plato"
 *
 * A throwaway free-plan factory user (FRESCO-308) with a full seeded week
 * (`seedFullWeekMenu`). The seed puts ONE recipe in every slot of a meal type,
 * so the scenario picks a catalogue card whose recipe differs from it: the
 * replacement is then observable, not a no-op. What is asserted against the
 * database is read with the user's own token, never service-role.
 *
 * Only slots of today or later are offered (Europe/Madrid), so the scenarios
 * pick whatever the dialog offers instead of a fixed weekday: on a Sunday the
 * dialog offers just that day, which is still enough.
 */

const { Given, When, Then } = createBdd(test);

interface Ctx {
  testUser: TestUser | null
  seededRecipe: string
  chosenRecipe: string
  chosenSlotId: string
}
const ctx: Ctx = { testUser: null, seededRecipe: '', chosenRecipe: '', chosenSlotId: '' };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

async function loginAndGoToLibrary(page: Page, testUser: TestUser, mealType: 'comida' | 'cena'): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('email_input').fill(testUser.email);
  await page.getByTestId('password_input').fill(testUser.password);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL(url => /\/(?:menu|onboarding)/.test(url.pathname));
  await page.goto(`/recipes?meal=${mealType}`);
  await expect(page.getByTestId('recipe_library_grid')).toBeVisible();
}

/** Opens the dialog on the first catalogue card whose recipe is not `exceptName`. Returns that recipe's name. */
async function openAddToMenuOnACard(page: Page, exceptName: string): Promise<string> {
  const card = page.getByTestId('recipe_library_grid').locator('a').filter({ hasNotText: exceptName }).first();
  const nombre = (await card.getByRole('heading').textContent())?.trim() ?? '';
  expect(nombre).not.toBe('');
  await card.getByTestId('recipe_card_add_to_menu_button').click();
  await expect(page.getByTestId('add_to_menu_dialog')).toBeVisible();
  await expect(page.getByTestId('add_to_menu_slot_option').first()).toBeVisible();
  return nombre;
}

async function slotRows(testUser: TestUser, ids: string[]): Promise<{ id: string, tipo_plato: string, recipes: { nombre: string } | null }[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/meal_plan_recipes?id=in.(${ids.join(',')})&select=id,tipo_plato,recipes(nombre)`,
    { headers: restHeaders(testUser.accessToken) },
  );
  return await res.json() as { id: string, tipo_plato: string, recipes: { nombre: string } | null }[];
}

// ── Escenario 1: añadir una receta al menú ───────────────────────────────

Given(/^que Laura tiene un menú semanal con huecos pendientes$/, async ({ page, request, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  const { comidaNombre } = await seedFullWeekMenu(request, testUser);
  ctx.seededRecipe = comidaNombre;
  await loginAndGoToLibrary(page, testUser, 'comida');
});

When(/^pulsa el icono de calendario de una receta de comida y elige un hueco de comida$/, async ({ page }) => {
  ctx.chosenRecipe = await openAddToMenuOnACard(page, ctx.seededRecipe);
  const option = page.getByTestId('add_to_menu_slot_option').first();
  ctx.chosenSlotId = (await option.getAttribute('value')) ?? '';
  expect(ctx.chosenSlotId).not.toBe('');
  await option.check();
});

When(/^acepta$/, async ({ page }) => {
  await page.getByTestId('add_to_menu_confirm_button').click();
});

Then(/^ese hueco pasa a mostrar la receta elegida$/, async () => {
  const testUser = ctx.testUser!;
  await expect.poll(async () => (await slotRows(testUser, [ctx.chosenSlotId]))[0]?.recipes?.nombre).toBe(ctx.chosenRecipe);
});

Then(/^ve una confirmación de que la comida se ha sustituido$/, async ({ page }) => {
  const success = page.getByTestId('add_to_menu_success');
  await expect(success).toBeVisible();
  await expect(success).toContainText(ctx.chosenRecipe);
});

// ── Escenario 2: solo huecos del mismo tipo de plato ─────────────────────

Given(/^una receta de tipo cena en la Biblioteca$/, async ({ page, request, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  const { cenaNombre } = await seedFullWeekMenu(request, testUser);
  ctx.seededRecipe = cenaNombre;
  await loginAndGoToLibrary(page, testUser, 'cena');
});

When(/^abre el modal de añadir al menú$/, async ({ page }) => {
  ctx.chosenRecipe = await openAddToMenuOnACard(page, ctx.seededRecipe);
});

Then(/^solo puede elegir huecos de cena$/, async ({ page }) => {
  const ids = await page.getByTestId('add_to_menu_slot_option').evaluateAll(
    options => options.map(option => (option as HTMLInputElement).value),
  );
  expect(ids.length).toBeGreaterThan(0);

  const rows = await slotRows(ctx.testUser!, ids);
  expect(rows).toHaveLength(ids.length);
  expect(rows.every(row => row.tipo_plato === 'cena')).toBe(true);
});
