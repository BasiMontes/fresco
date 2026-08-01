import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

/**
 * Step definitions for `.context/qa/regression.feature` — @calendario,
 * "El sistema rechaza un intercambio entre franjas de tipo distinto".
 *
 * Uses the dedicated `PRO_TEST_USER_EMAIL` account (same reset-and-reseed
 * convention `entrega-parcial.steps.ts` and `aprendizaje-pro.steps.ts`
 * already use for it) rather than the shared `LOCAL_USER_EMAIL` — that
 * account's current-week plan is the exact fixture `@aprendizaje`'s
 * cocinada/descartada scenarios depend on, and this scenario needs to
 * reset+reseed the whole week to know each slot's exact recipe name before
 * asserting nothing changed.
 */

const { Given, When, Then } = createBdd(test);

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
const TIPOS = ['desayuno', 'comida', 'cena'] as const;

interface Ctx { desayunoNombre: string, cenaNombre: string }
const ctx: Ctx = { desayunoNombre: '', cenaNombre: '' };

/** Monday of the current ISO week, `YYYY-MM-DD` — same algorithm as `entrega-parcial.steps.ts`. */
function currentWeekMonday(): { semanaIso: string, fechaInicio: string } {
  const now = new Date();
  const day = now.getUTCDay() || 7;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - day + 1);
  const fechaInicio = monday.toISOString().slice(0, 10);

  const target = new Date(monday);
  target.setUTCDate(target.getUTCDate() + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(
    ((target.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
  );
  return { semanaIso: `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`, fechaInicio };
}

async function getAccessToken(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const response = await request.post(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      data: { email: process.env.PRO_TEST_USER_EMAIL, password: process.env.PRO_TEST_USER_PASSWORD },
    },
  );
  const body = await response.json() as { access_token: string };
  return body.access_token;
}

Given(/^que el usuario tiene un menú semanal generado con los 21 huecos llenos$/, async ({ page, request }) => {
  if (!process.env.PRO_TEST_USER_EMAIL || !process.env.PRO_TEST_USER_PASSWORD) {
    throw new Error('PRO_TEST_USER_EMAIL / PRO_TEST_USER_PASSWORD must be set in .env for this scenario.');
  }

  const accessToken = await getAccessToken(request);
  const headers = {
    'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
  const userRes = await request.get(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, { headers });
  const { id: userId } = await userRes.json() as { id: string };
  const { semanaIso, fechaInicio } = currentWeekMonday();

  await request.delete(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/meal_plans?id=not.is.null`, { headers });

  // One real recipe per tipo_plato — distinct names so the assertion below
  // can tell "swapped" from "unchanged" unambiguously.
  const recipesByTipo: Record<string, { id: string, nombre: string }> = {};
  for (const tipo of TIPOS) {
    const res = await request.get(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/recipes?select=id,nombre&clasificacion->>tipo_plato=eq.${tipo}&limit=1`,
      { headers },
    );
    const [recipe] = await res.json() as { id: string, nombre: string }[];
    if (!recipe) { throw new Error(`No hay ninguna receta de tipo ${tipo} en el catálogo para sembrar el fixture.`); }
    recipesByTipo[tipo] = recipe;
  }
  ctx.desayunoNombre = recipesByTipo.desayuno.nombre;
  ctx.cenaNombre = recipesByTipo.cena.nombre;

  const planRes = await request.post(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/meal_plans`, {
    headers: { ...headers, Prefer: 'return=representation' },
    data: { user_id: userId, semana_iso: semanaIso, fecha_inicio: fechaInicio, advertencias: [] },
  });
  if (!planRes.ok()) { throw new Error(`Failed to seed meal_plans: ${planRes.status()} ${await planRes.text()}`); }
  const [plan] = await planRes.json() as { id: string }[];

  const slots = DIAS.flatMap(dia => TIPOS.map(tipo => ({
    meal_plan_id: plan.id,
    recipe_id: recipesByTipo[tipo].id,
    dia,
    tipo_plato: tipo,
  })));
  const slotsRes = await request.post(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/meal_plan_recipes`, { headers, data: slots });
  if (!slotsRes.ok()) { throw new Error(`Failed to seed meal_plan_recipes: ${slotsRes.status()} ${await slotsRes.text()}`); }

  await page.goto('/login');
  await page.getByTestId('email_input').fill(process.env.PRO_TEST_USER_EMAIL);
  await page.getByTestId('password_input').fill(process.env.PRO_TEST_USER_PASSWORD);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL('**/menu');
  await page.goto('/calendar');
});

When(/^arrastra el plato de un desayuno sobre el hueco de una cena$/, async ({ page }) => {
  await page
    .getByTestId('calendar_slot_lunes_desayuno')
    .getByRole('button', { name: 'Arrastrar para reordenar' })
    .dragTo(page.getByTestId('calendar_slot_lunes_cena').getByRole('button', { name: 'Arrastrar para reordenar' }));
});

Then(/^el intercambio no se realiza$/, async ({ page }) => {
  await expect(page.getByTestId('calendar_slot_lunes_desayuno')).toContainText(ctx.desayunoNombre);
});

Then(/^ambos huecos conservan su receta y su franja originales$/, async ({ page }) => {
  await expect(page.getByTestId('calendar_slot_lunes_desayuno')).toContainText(ctx.desayunoNombre);
  await expect(page.getByTestId('calendar_slot_lunes_cena')).toContainText(ctx.cenaNombre);
});
