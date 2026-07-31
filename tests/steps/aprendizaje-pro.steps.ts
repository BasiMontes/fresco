import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

/**
 * Step definitions for `.context/qa/regression.feature` — @aprendizaje,
 * "El usuario Pro ve la tarjeta de explicación en /menu" (FR-5.5,
 * FRESCO-22).
 *
 * Same dedicated-account rationale as `entrega-parcial.steps.ts`: this
 * needs `plan = 'pro'` plus 2 weeks of real history on the account, which
 * would corrupt `@aprendizaje`'s own pendiente-slot fixture on the shared
 * `LOCAL_USER_EMAIL` account.
 *
 * Real Gemini call (real generation, real isPro branch, real history read)
 * — no mocking here, same acceptance as @lista-compra: a network mock can't
 * produce a real card-insight to assert against.
 */

const { Given, When, Then } = createBdd(test);

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
const TIPOS = ['desayuno', 'comida', 'cena'] as const;

function isoWeekOf(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86_400_000
    - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function mondayOfWeekContaining(date: Date): Date {
  const day = date.getUTCDay() || 7;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - day + 1);
  return monday;
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

function restHeaders(accessToken: string) {
  return {
    'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

Given(/^que un usuario Pro tiene explicacion_aprendizaje no nula en su menú$/, async ({ request }) => {
  if (!process.env.PRO_TEST_USER_EMAIL || !process.env.PRO_TEST_USER_PASSWORD) {
    throw new Error('PRO_TEST_USER_EMAIL / PRO_TEST_USER_PASSWORD must be set in .env for this scenario.');
  }

  const accessToken = await getAccessToken(request);
  const headers = restHeaders(accessToken);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const userId = await currentUserId(request, accessToken);

  // Real history requires a real Pro-tier profile — get_recent_recipe_ids()
  // is read unconditionally by index.ts once isPro is true server-side.
  const patchRes = await request.patch(`${url}/rest/v1/user_profiles`, {
    headers: { ...headers, Prefer: 'return=minimal' },
    params: { id: `eq.${userId}` },
    data: { plan: 'pro' },
  });
  if (!patchRes.ok()) { throw new Error(`Failed to set plan=pro: ${patchRes.status()} ${await patchRes.text()}`); }

  // Clean slate: this account's own plans only.
  await request.delete(`${url}/rest/v1/meal_plans?id=not.is.null`, { headers });

  // Real recipe ids from the live catalog (never hardcoded).
  const recipesRes = await request.get(`${url}/rest/v1/recipes?select=id&limit=5`, { headers });
  const recipes = await recipesRes.json() as { id: string }[];
  if (recipes.length === 0) { throw new Error('No recipes available in the catalog to seed the fixture.'); }

  // Seed a real "last week" plan so get_recent_recipe_ids() (2-week window)
  // finds real history for this account.
  const lastMonday = mondayOfWeekContaining(new Date());
  lastMonday.setUTCDate(lastMonday.getUTCDate() - 7);
  const lastWeekPlanRes = await request.post(`${url}/rest/v1/meal_plans`, {
    headers: { ...headers, Prefer: 'return=representation' },
    data: {
      user_id: userId,
      semana_iso: isoWeekOf(lastMonday),
      fecha_inicio: lastMonday.toISOString().slice(0, 10),
      advertencias: [],
    },
  });
  if (!lastWeekPlanRes.ok()) {
    throw new Error(`Failed to seed last week's meal_plans: ${lastWeekPlanRes.status()} ${await lastWeekPlanRes.text()}`);
  }
  const [lastWeekPlan] = await lastWeekPlanRes.json() as { id: string }[];

  const lastWeekSlots = DIAS.flatMap((dia, dIdx) => TIPOS.map(tipo => ({
    meal_plan_id: lastWeekPlan.id,
    recipe_id: recipes[dIdx % recipes.length].id,
    dia,
    tipo_plato: tipo,
    estado: 'cocinada' as const,
  })));
  const seedRes = await request.post(`${url}/rest/v1/meal_plan_recipes`, { headers, data: lastWeekSlots });
  if (!seedRes.ok()) { throw new Error(`Failed to seed last week's history: ${seedRes.status()} ${await seedRes.text()}`); }

  // Real generation for the CURRENT week — real Gemini call, real isPro
  // branch, real history read. No mock: a network-mocked response can't
  // produce a real card-insight to assert against.
  const genRes = await request.post(`${url}/functions/v1/generate-meal-plan`, {
    headers,
    data: { semana_iso: isoWeekOf(new Date()), fecha_inicio: mondayOfWeekContaining(new Date()).toISOString().slice(0, 10) },
    timeout: 120_000,
  });
  if (!genRes.ok()) { throw new Error(`generate-meal-plan failed: ${genRes.status()} ${await genRes.text()}`); }
});

async function currentUserId(request: import('@playwright/test').APIRequestContext, accessToken: string): Promise<string> {
  const res = await request.get(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json() as { id: string };
  return body.id;
}

When(/^visita \/menu$/, async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('email_input').fill(process.env.PRO_TEST_USER_EMAIL!);
  await page.getByTestId('password_input').fill(process.env.PRO_TEST_USER_PASSWORD!);
  await page.getByTestId('login_submit_button').click();
  await page.waitForURL('**/menu');
});

Then(/^ve una tarjeta "card-insight" con esa explicación$/, async ({ page }) => {
  const card = page.getByTestId('learning_explanation_card');
  await expect(card).toBeVisible();
  await expect(card).not.toHaveText('');
});

Then(/^nunca se mezcla visualmente con el banner de advertencias$/, async ({ page }) => {
  const cardText = await page.getByTestId('learning_explanation_card').textContent();
  const banner = page.getByTestId('menu_advertencias_banner');
  if (await banner.isVisible()) {
    const bannerText = await banner.textContent();
    expect(bannerText).not.toContain(cardText);
  }
});
