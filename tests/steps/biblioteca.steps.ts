import type { Page } from '@playwright/test';
import type { TestUser } from '../test-user-factory';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { currentWeekMonday, restHeaders } from '../test-helpers';
import { generateCurrentWeekPlan } from '../test-user-factory';

/**
 * Step definitions for `.context/qa/regression.feature` — @biblioteca, the
 * happy paths of the recipe library at `/recipes` (EPIC-FRESCO-64):
 * search by name / ingredient, the filter drawer (comida / cocina / dieta /
 * alérgeno), clearing filters, combined search + filter, creating a personal
 * recipe, and opening a catalog recipe's detail.
 *
 * FRESCO-353 (2nd batch of the FRESCO-321 ratchet). The Gherkin predates the
 * FRESCO-274 redesign (tabs → a filter drawer); the steps map the original
 * wording onto the current live UI (CLAUDE.md Rule 14 — LIVE-UI-FIRST).
 * A throwaway free-plan factory user (FRESCO-308) sees the full catalog.
 */

const { Given, When, Then } = createBdd(test);

interface Ctx {
  testUser: TestUser | null
  totalCount: number
  createdRecipeName: string
}
const ctx: Ctx = { testUser: null, totalCount: 0, createdRecipeName: '' };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

async function loginAndGoToLibrary(page: Page, testUser: TestUser): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('email_input').fill(testUser.email);
  await page.getByTestId('password_input').fill(testUser.password);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL(url => /\/(?:menu|onboarding)/.test(url.pathname));
  await page.goto('/recipes');
  await expect(page.getByTestId('recipe_library_grid')).toBeVisible();
}

/** The "N recetas encontradas" figure the library shows under the controls. */
async function shownCount(page: Page): Promise<number> {
  const text = await page.getByTestId('recipe_library_count').textContent();
  return Number.parseInt(text?.match(/\d+/)?.[0] ?? '0', 10);
}

async function applyDrawerFilter(page: Page, sectionTestId: string, optionLabel: string): Promise<void> {
  await page.getByTestId('filtrar_y_ordenar_button').click();
  await expect(page.getByTestId('recipe_filter_drawer')).toBeVisible();
  // The section header (the testid'd element) toggles the option list open.
  await page.getByTestId(sectionTestId).click();
  // Checkbox's real <input> is aria-hidden + opacity-0 (FRESCO-191) — no
  // 'checkbox' role to target; click the wrapping <label> instead.
  await page.locator('label').filter({ hasText: optionLabel }).click();
  await page.getByTestId('recipe_filter_drawer_apply_button').click();
  await expect(page.getByTestId('recipe_filter_drawer')).toBeHidden();
  // FRESCO-384: filtering is URL-driven and navigates in a transition — wait
  // for the filter param to land before asserting on the re-rendered list.
  await page.waitForURL(/[?&](meal|cocina|dieta|alergeno)=/);
}

// ── Given: en la Biblioteca ───────────────────────────────────────────────

Given(/^que Laura está en la Biblioteca(?: de recetas)?$/, async ({ page, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await loginAndGoToLibrary(page, testUser);
  ctx.totalCount = await shownCount(page);
  expect(ctx.totalCount).toBeGreaterThan(0);
});

Given(/^que Laura tiene una pestaña de tipo de comida activa$/, async ({ page, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await loginAndGoToLibrary(page, testUser);
  ctx.totalCount = await shownCount(page);
  await applyDrawerFilter(page, 'recipe_filter_section_comida', 'Cena');
  await expect.poll(async () => shownCount(page)).toBeLessThan(ctx.totalCount);
});

Given(/^que Laura tiene la pestaña "Cena" activa$/, async ({ page, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await loginAndGoToLibrary(page, testUser);
  ctx.totalCount = await shownCount(page);
  await applyDrawerFilter(page, 'recipe_filter_section_comida', 'Cena');
});

Given(/^que Laura quiere evitar un ingrediente puntual que no tiene declarado en su perfil$/, async ({ page, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await loginAndGoToLibrary(page, testUser);
  ctx.totalCount = await shownCount(page);
});

// ── When ─────────────────────────────────────────────────────────────────

When(/^escribe el nombre de una receta en el buscador$/, async ({ page }) => {
  await page.getByTestId('recipe_search_input').fill('Paella');
});

When(/^escribe un ingrediente en el buscador$/, async ({ page }) => {
  await page.getByTestId('recipe_search_input').fill('pollo');
});

When(/^toca la pestaña "Cena"$/, async ({ page }) => {
  await applyDrawerFilter(page, 'recipe_filter_section_comida', 'Cena');
});

When(/^toca "Todo"$/, async ({ page }) => {
  await page.getByTestId('filtrar_y_ordenar_button').click();
  await page.getByTestId('recipe_filter_drawer_clear_all_button').click();
  await page.getByTestId('recipe_filter_drawer_apply_button').click();
  await expect(page.getByTestId('recipe_filter_drawer')).toBeHidden();
});

When(/^escribe algo en el buscador$/, async ({ page }) => {
  await page.getByTestId('recipe_search_input').fill('a');
});

When(/^selecciona un filtro de cocina, por ejemplo "Italiana"$/, async ({ page }) => {
  await applyDrawerFilter(page, 'recipe_filter_section_cocina', 'Italiana');
});

When(/^selecciona un filtro de dieta, por ejemplo "Vegano"$/, async ({ page }) => {
  await applyDrawerFilter(page, 'recipe_filter_section_dieta', 'vegano');
});

When(/^activa ese filtro de alérgeno en la Biblioteca$/, async ({ page }) => {
  await applyDrawerFilter(page, 'recipe_filter_section_alergeno', 'Gluten');
});

When(/^completa el formulario "Crear propia" con nombre, ingredientes y pasos, y confirma$/, async ({ page }) => {
  ctx.createdRecipeName = `Mi receta e2e ${Date.now()}`;
  await page.getByTestId('crear_propia_button').click();
  await expect(page.getByTestId('create_recipe_dialog')).toBeVisible();
  await page.getByTestId('receta_nombre_input').fill(ctx.createdRecipeName);
  await page.getByTestId('receta_ingredientes_input').fill('Tomate\nPan\nAceite de oliva');
  await page.getByTestId('receta_pasos_input').fill('Tostar el pan\nAñadir tomate y aceite');
  await page.getByTestId('guardar_receta_button').click();
  await expect(page.getByTestId('create_recipe_dialog')).toBeHidden();
});

When(/^abre una receta del catálogo$/, async ({ page }) => {
  await page.getByTestId('recipe_library_grid').getByRole('link').first().click();
  await page.waitForURL('**/recipes/**');
});

// ── Then ─────────────────────────────────────────────────────────────────

Then(/^ve solo las recetas del catálogo que coinciden con ese nombre$/, async ({ page }) => {
  await expect.poll(async () => shownCount(page)).toBeLessThan(ctx.totalCount);
  await expect(page.getByTestId('recipe_library_grid')).toContainText(/paella/i);
});

Then(/^ve las recetas del catálogo que contienen ese ingrediente$/, async ({ page }) => {
  await expect.poll(async () => shownCount(page)).toBeGreaterThan(0);
  await expect.poll(async () => shownCount(page)).toBeLessThan(ctx.totalCount);
});

Then(/^ve solo recetas de cena del catálogo$/, async ({ page }) => {
  await expect.poll(async () => shownCount(page)).toBeLessThan(ctx.totalCount);
  await expect.poll(async () => shownCount(page)).toBeGreaterThan(0);
});

Then(/^vuelve a ver el catálogo completo$/, async ({ page }) => {
  await expect.poll(async () => shownCount(page)).toBe(ctx.totalCount);
});

Then(/^los resultados respetan ambos filtros a la vez$/, async ({ page }) => {
  await expect(page.getByTestId('filtrar_y_ordenar_button')).toContainText('1');
  await expect(page.getByTestId('recipe_search_input')).toHaveValue('a');
});

Then(/^ve solo recetas de esa cocina$/, async ({ page }) => {
  await expect.poll(async () => shownCount(page)).toBeLessThan(ctx.totalCount);
  await expect.poll(async () => shownCount(page)).toBeGreaterThan(0);
});

Then(/^ve solo recetas que cumplen esa restricción$/, async ({ page }) => {
  await expect.poll(async () => shownCount(page)).toBeLessThan(ctx.totalCount);
  await expect.poll(async () => shownCount(page)).toBeGreaterThan(0);
});

Then(/^no ve ninguna receta que lo contenga, sin que cambie su perfil permanente$/, async ({ page }) => {
  await expect.poll(async () => shownCount(page)).toBeLessThan(ctx.totalCount);
});

Then(/^su receta aparece en la sección "Tus recetas", distinguible del catálogo$/, async ({ page }) => {
  await expect(page.getByTestId('personal_recipes_section')).toBeVisible();
  await expect(page.getByTestId('personal_recipes_section')).toContainText(ctx.createdRecipeName);
});

Then(/^ve su nombre, ingredientes, pasos, tiempo, dificultad y tags de dieta\/alérgeno\/cocina$/, async ({ page }) => {
  await expect(page.getByTestId('recipe_detail_ingredientes')).toBeVisible();
  await expect(page.getByTestId('recipe_detail_pasos')).toBeVisible();
  await expect(page.getByTestId('recipe_detail_tags')).toBeVisible();
});

// ── FRESCO-355 mini-batch: personal recipes + validation + back link ──────

async function createOwnRecipe(page: Page, name: string): Promise<void> {
  await page.getByTestId('crear_propia_button').click();
  await expect(page.getByTestId('create_recipe_dialog')).toBeVisible();
  await page.getByTestId('receta_nombre_input').fill(name);
  await page.getByTestId('receta_ingredientes_input').fill('Tomate\nPan');
  await page.getByTestId('receta_pasos_input').fill('Tostar el pan\nAñadir tomate');
  await page.getByTestId('guardar_receta_button').click();
  await expect(page.getByTestId('create_recipe_dialog')).toBeHidden();
}

Given(/^que Laura abre el formulario de "Crear propia" sin completar el nombre$/, async ({ page, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await loginAndGoToLibrary(page, testUser);
  await page.getByTestId('crear_propia_button').click();
  await expect(page.getByTestId('create_recipe_dialog')).toBeVisible();
});

Given(/^que Laura tiene una receta propia en su Biblioteca$/, async ({ page, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await loginAndGoToLibrary(page, testUser);
  ctx.createdRecipeName = `Mi receta e2e ${Date.now()}`;
  await createOwnRecipe(page, ctx.createdRecipeName);
});

Given(/^que Laura tiene una receta propia guardada$/, async ({ page, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await loginAndGoToLibrary(page, testUser);
  ctx.createdRecipeName = `Receta propia e2e ${Date.now()}`;
  await createOwnRecipe(page, ctx.createdRecipeName);
});

Given(/^que Laura está viendo el detalle de una receta$/, async ({ page, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await loginAndGoToLibrary(page, testUser);
  await page.getByTestId('recipe_library_grid').getByRole('link').first().click();
  await page.waitForURL('**/recipes/**');
});

When(/^intenta guardar$/, async ({ page }) => {
  // The submit button stays disabled while the name is empty; typing then
  // clearing marks the field touched so the inline validation renders.
  await page.getByTestId('receta_nombre_input').fill('x');
  await page.getByTestId('receta_nombre_input').fill('');
});

When(/^la abre$/, async ({ page }) => {
  await page.getByTestId('personal_recipes_section').getByRole('link').first().click();
  await page.waitForURL('**/recipes/**');
});

When(/^elige volver$/, async ({ page }) => {
  await page.getByTestId('recipe_detail_back_link').click();
});

When(/^genera un menú semanal nuevo$/, async ({ request }) => {
  await generateCurrentWeekPlan(request, ctx.testUser!);
});

Then(/^ve un mensaje claro pidiéndole completar el nombre antes de guardar$/, async ({ page }) => {
  await expect(page.getByTestId('receta_nombre_validation_message')).toBeVisible();
  await expect(page.getByTestId('guardar_receta_button')).toBeDisabled();
});

Then(/^ve su nombre, ingredientes y pasos, distinguible como receta propia$/, async ({ page }) => {
  await expect(page.getByText('Tu receta')).toBeVisible();
  await expect(page.getByTestId('recipe_detail_ingredientes')).toBeVisible();
  await expect(page.getByTestId('recipe_detail_pasos')).toBeVisible();
});

Then(/^regresa a la Biblioteca$/, async ({ page }) => {
  await expect(page).toHaveURL(/\/recipes$/);
});

Then(/^esa receta propia nunca aparece en el menú generado por la IA$/, async ({ request }) => {
  const testUser = ctx.testUser!;
  const { semanaIso } = currentWeekMonday();
  const headers = restHeaders(testUser.accessToken);
  const planRes = await request.get(
    `${SUPABASE_URL}/rest/v1/meal_plans?select=id&user_id=eq.${testUser.id}&semana_iso=eq.${semanaIso}`,
    { headers },
  );
  const [plan] = await planRes.json() as { id: string }[];
  const slotsRes = await request.get(
    `${SUPABASE_URL}/rest/v1/meal_plan_recipes?select=recipes(nombre)&meal_plan_id=eq.${plan.id}`,
    { headers },
  );
  const names = (await slotsRes.json() as { recipes: { nombre: string } | null }[])
    .map(r => r.recipes?.nombre)
    .filter(Boolean);
  expect(names).not.toContain(ctx.createdRecipeName);
  expect(names.length).toBe(21);
});
