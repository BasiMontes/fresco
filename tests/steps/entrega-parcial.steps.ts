import type { APIRequestContext } from '@playwright/test';
import type { TestUser } from '../test-user-factory';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { currentWeekMonday, restHeaders } from '../test-helpers';

/**
 * Step definitions for `.context/qa/regression.feature` — @generacion-menu,
 * "El frontend muestra la franja sin receta" (FR-8.2 / AC Scenario 4,
 * FRESCO-23).
 *
 * FRESCO-356: migrated off the shared `PRO_USER` account to a throwaway
 * factory user (FRESCO-308). Seeds the exact row shape
 * `generate-meal-plan/index.ts` would write — 20 real slots + one
 * `recipe_id: null` at lunes/desayuno (the slot `/menu` always renders as
 * "today") — plus the matching `advertencias` on the plan.
 */

const { Given, When, Then } = createBdd(test);

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
const TIPOS = ['desayuno', 'comida', 'cena'] as const;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

interface Ctx { testUser: TestUser | null }
const ctx: Ctx = { testUser: null };

async function seedPlanWithNullSlot(request: APIRequestContext, testUser: TestUser): Promise<void> {
  const headers = restHeaders(testUser.accessToken);
  const { semanaIso, fechaInicio } = currentWeekMonday();

  const recipesRes = await request.get(`${SUPABASE_URL}/rest/v1/recipes?select=id&limit=1`, { headers });
  const [recipe] = await recipesRes.json() as { id: string }[];

  const planRes = await request.post(`${SUPABASE_URL}/rest/v1/meal_plans`, {
    headers: { ...headers, Prefer: 'return=representation' },
    data: {
      user_id: testUser.id,
      semana_iso: semanaIso,
      fecha_inicio: fechaInicio,
      advertencias: ['No hay ninguna receta de desayuno compatible con tus alergias y tu dieta. Revisa tus restricciones o añade recetas propias.'],
    },
  });
  const [plan] = await planRes.json() as { id: string }[];

  const slots = DIAS.flatMap(dia => TIPOS.map(tipo => ({
    meal_plan_id: plan.id,
    recipe_id: dia === 'lunes' && tipo === 'desayuno' ? null : recipe.id,
    dia,
    tipo_plato: tipo,
  })));
  const slotsRes = await request.post(`${SUPABASE_URL}/rest/v1/meal_plan_recipes`, { headers, data: slots });
  if (!slotsRes.ok()) { throw new Error(`Failed to seed meal_plan_recipes: ${slotsRes.status()} ${await slotsRes.text()}`); }
}

Given(/^que un menú persistido tiene una franja con recipe_id null$/, async ({ request, testUserFactory }) => {
  ctx.testUser = await testUserFactory();
  await seedPlanWithNullSlot(request, ctx.testUser);
});

When(/^el usuario visita \/menu o \/calendar$/, async ({ page }) => {
  const testUser = ctx.testUser!;
  await page.goto('/login');
  await page.getByTestId('email_input').fill(testUser.email);
  await page.getByTestId('password_input').fill(testUser.password);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL(url => /\/(?:menu|onboarding)/.test(url.pathname));
  await page.goto('/menu');
});

Then(/^ve esa franja marcada como "Sin receta", sin crashear$/, async ({ page }) => {
  await expect(page.getByTestId('menu_slot_desayuno_sin_receta')).toBeVisible();
  await expect(page.getByTestId('menu_advertencias_banner')).toBeVisible();
});

Then(/^no puede arrastrarla ni marcarla como cocinada\/descartada$/, async ({ page }) => {
  await page.goto('/calendar');
  await expect(page.getByTestId('calendar_slot_lunes_desayuno_sin_receta')).toBeVisible();
  await expect(page.getByTestId('calendar_slot_lunes_desayuno_mark_cocinada')).toHaveCount(0);
  await expect(page.getByTestId('calendar_slot_lunes_desayuno_mark_descartada')).toHaveCount(0);
  await expect(
    page.getByTestId('calendar_slot_lunes_desayuno').getByRole('button', { name: 'Arrastrar para reordenar' }),
  ).toHaveCount(0);
});
