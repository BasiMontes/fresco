import type { Page } from '@playwright/test';
import type { TestUser } from '../test-user-factory';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { currentWeekMonday, restHeaders } from '../test-helpers';
import { seedFullWeekMenu } from '../test-user-factory';

/**
 * Step definitions for `.context/qa/regression.feature` — @calendario,
 * drag & drop reordering (STORY-FRESCO-11):
 *   - "El usuario reordena su menú arrastrando un plato a otro hueco"
 *   - "El orden reordenado sobrevive a recargar la página"
 *
 * FRESCO-352 (ratchet de FRESCO-321). `seedFullWeekMenu` seeds the SAME
 * recipe into every slot of a `tipo_plato`, so a comida→comida swap would be
 * invisible — this setup patches lunes/martes comida to two DISTINCT comida
 * recipes first, then asserts the swap both on screen and in the DB.
 */

const { Given, When, Then } = createBdd(test);

interface Ctx {
  testUser: TestUser | null
  recetaA: string
  recetaB: string
}
const ctx: Ctx = { testUser: null, recetaA: '', recetaB: '' };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

async function seedTwoDistinctLunches(request: import('@playwright/test').APIRequestContext, testUser: TestUser): Promise<void> {
  await seedFullWeekMenu(request, testUser);
  const headers = restHeaders(testUser.accessToken);
  const { semanaIso } = currentWeekMonday();

  const recipesRes = await request.get(
    `${SUPABASE_URL}/rest/v1/recipes?select=id,nombre&clasificacion->>tipo_plato=eq.comida&limit=2`,
    { headers },
  );
  const [a, b] = await recipesRes.json() as { id: string, nombre: string }[];
  ctx.recetaA = a.nombre;
  ctx.recetaB = b.nombre;

  const planRes = await request.get(
    `${SUPABASE_URL}/rest/v1/meal_plans?select=id&user_id=eq.${testUser.id}&semana_iso=eq.${semanaIso}`,
    { headers },
  );
  const [plan] = await planRes.json() as { id: string }[];

  await request.patch(
    `${SUPABASE_URL}/rest/v1/meal_plan_recipes?meal_plan_id=eq.${plan.id}&dia=eq.lunes&tipo_plato=eq.comida`,
    { headers, data: { recipe_id: a.id } },
  );
  await request.patch(
    `${SUPABASE_URL}/rest/v1/meal_plan_recipes?meal_plan_id=eq.${plan.id}&dia=eq.martes&tipo_plato=eq.comida`,
    { headers, data: { recipe_id: b.id } },
  );
}

async function loginAndGoToCalendar(page: Page, testUser: TestUser): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('email_input').fill(testUser.email);
  await page.getByTestId('password_input').fill(testUser.password);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL(url => /\/(?:menu|onboarding)/.test(url.pathname));
  await page.goto('/calendar');
}

async function dragLunesOntoMartes(page: Page): Promise<void> {
  // dnd-kit's MouseSensor has an 8px activation distance (calendar-grid.tsx,
  // FRESCO-170) — Playwright's `dragTo` jumps straight to the target and
  // never crosses that threshold with the pointer held, so the drag never
  // activates. Manual mouse steps with an intermediate move past 8px do.
  const source = page.getByTestId('calendar_slot_lunes_comida').getByRole('button', { name: 'Arrastrar para reordenar' });
  const target = page.getByTestId('calendar_slot_martes_comida').getByRole('button', { name: 'Arrastrar para reordenar' });
  const sb = await source.boundingBox();
  const tb = await target.boundingBox();
  if (!sb || !tb) { throw new Error('drag handles not visible'); }

  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(sb.x + sb.width / 2 + 20, sb.y + sb.height / 2, { steps: 5 });
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 10 });
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 5 });
  await page.mouse.up();
}

async function dbRecipeNameAt(request: import('@playwright/test').APIRequestContext, testUser: TestUser, dia: string): Promise<string> {
  const { semanaIso } = currentWeekMonday();
  const res = await request.get(
    `${SUPABASE_URL}/rest/v1/meal_plan_recipes?select=recipes(nombre),meal_plans!inner(semana_iso,user_id)&dia=eq.${dia}&tipo_plato=eq.comida&meal_plans.user_id=eq.${testUser.id}&meal_plans.semana_iso=eq.${semanaIso}`,
    { headers: restHeaders(testUser.accessToken) },
  );
  const [row] = await res.json() as { recipes: { nombre: string } }[];
  return row.recipes.nombre;
}

Given(/^que el usuario tiene un menú generado con los 21 huecos llenos$/, async ({ page, request, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await seedTwoDistinctLunches(request, testUser);
  await loginAndGoToCalendar(page, testUser);
  await expect(page.getByTestId('calendar_slot_lunes_comida')).toContainText(ctx.recetaA);
  await expect(page.getByTestId('calendar_slot_martes_comida')).toContainText(ctx.recetaB);
});

When(/^arrastra el plato de un día\/tipo a otro hueco distinto$/, async ({ page }) => {
  await dragLunesOntoMartes(page);
});

Then(/^ambos huecos intercambian su receta inmediatamente en pantalla$/, async ({ page }) => {
  await expect(page.getByTestId('calendar_slot_lunes_comida')).toContainText(ctx.recetaB);
  await expect(page.getByTestId('calendar_slot_martes_comida')).toContainText(ctx.recetaA);
});

Then(/^el cambio queda persistido en base de datos sin acción adicional$/, async ({ request }) => {
  const testUser = ctx.testUser!;
  await expect.poll(async () => dbRecipeNameAt(request, testUser, 'lunes')).toBe(ctx.recetaB);
  expect(await dbRecipeNameAt(request, testUser, 'martes')).toBe(ctx.recetaA);
});

Given(/^que el usuario reordenó su menú previamente$/, async ({ page, request, testUserFactory }) => {
  const testUser = await testUserFactory();
  ctx.testUser = testUser;
  await seedTwoDistinctLunches(request, testUser);
  await loginAndGoToCalendar(page, testUser);
  await dragLunesOntoMartes(page);
  await expect.poll(async () => dbRecipeNameAt(request, testUser, 'lunes')).toBe(ctx.recetaB);
});

When(/^recarga \/calendar$/, async ({ page }) => {
  await page.reload();
});

Then(/^ve el menú en el orden que dejó, no el orden original generado$/, async ({ page }) => {
  await expect(page.getByTestId('calendar_slot_lunes_comida')).toContainText(ctx.recetaB);
  await expect(page.getByTestId('calendar_slot_martes_comida')).toContainText(ctx.recetaA);
});
